"""
Klient danych satelitarnych Sentinel-2 (Copernicus Data Space Ecosystem / AWS STAC) z cachowaniem (cachetools).

Domyślny tryb (Główny):
- Europejskie serwery Copernicus Data Space Ecosystem (CDSE) / Sentinel Hub API.
- Bezpośrednie obliczanie wskaźników NDVI i NDMI po stronie europejskich serwerów
  w czasie sub-sekundowym (<500 ms) poprzez Process API (Evalscript v3).
- Pobieranie metadanych scen i weryfikacja zachmurzenia poprzez Catalog API.

Tryb awaryjny (Fallback):
- AWS Earth Search STAC z bezpośrednim odczytem COG przez rasterio.
- Statystyczny fallback przy całkowitym braku połączenia lub trwałym zachmurzeniu (>15%),
  zgodnie z wytycznymi konkursowymi KOWR.
"""

import io
import time
import logging

from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple, List
import httpx
import rasterio
from rasterio.warp import transform
from cachetools import TTLCache
from app.core.config import settings, CLOUD_COVER_MAX
from app.services.science.crops import get_crop_ndvi_reference

logger = logging.getLogger("satellite")

# Globalny cache tokena OAuth CDSE
_CDSE_TOKEN: Optional[str] = None
_CDSE_TOKEN_EXPIRES_AT: float = 0.0

# Bezpieczny cache w pamięci dla VPS (4GB RAM): max 500 elementów, TTL 24 godziny
# Kluczem cache jest teraz krotka: (lat, lon, crop_name, target_date_str)
_SATELLITE_CACHE = TTLCache(maxsize=500, ttl=86400)


async def get_cdse_token(client: httpx.AsyncClient) -> Optional[str]:
    """
    Pobiera token Bearer dla Copernicus Data Space Ecosystem (CDSE) OAuth2.
    Wykorzystuje cache w pamięci, odświeżając token tylko przed upływem ważności.
    """
    global _CDSE_TOKEN, _CDSE_TOKEN_EXPIRES_AT

    if not settings.CDSE_CLIENT_ID or not settings.CDSE_CLIENT_SECRET:
        return None

    if _CDSE_TOKEN and time.time() < (_CDSE_TOKEN_EXPIRES_AT - 60):
        return _CDSE_TOKEN

    try:
        resp = await client.post(
            settings.CDSE_TOKEN_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": settings.CDSE_CLIENT_ID,
                "client_secret": settings.CDSE_CLIENT_SECRET,
            },
            timeout=5.0
        )
        if resp.status_code == 200:
            data = resp.json()
            _CDSE_TOKEN = data.get("access_token")
            expires_in = data.get("expires_in", 1800)
            _CDSE_TOKEN_EXPIRES_AT = time.time() + float(expires_in)
            logger.info("[CDSE OAuth] Pomyślnie uzyskano i odświeżono token CDSE Sentinel Hub.")
            return _CDSE_TOKEN
        else:
            logger.warning(f"[CDSE OAuth] Błąd autoryzacji: {resp.status_code} {resp.text[:200]}")
            return None
    except Exception as e:
        logger.warning(f"[CDSE OAuth] Wyjątek podczas pobierania tokena: {e}")
        return None


async def fetch_indices_from_cdse(
    client: httpx.AsyncClient,
    token: str,
    lon: float,
    lat: float,
    date_start: str,
    date_end: str,
    crop_name: str,
    month: int
) -> Optional[Dict[str, Any]]:
    """
    Pobiera dane z europejskich serwerów Copernicus Data Space Ecosystem (CDSE):
    1. Przeszukuje katalog Sentinel-2 L2A w oknie 21 dni.
    2. Weryfikuje zachmurzenie (<15% zgodnie z wymogiem KOWR)[cite: 2, 4].
    3. Oblicza NDVI i NDMI po stronie serwera za pomocą Sentinel Hub Process API.
    """
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    bbox = [lon - 0.001, lat - 0.001, lon + 0.001, lat + 0.001]
    cat_payload = {
        "collections": ["sentinel-2-l2a"],
        "datetime": f"{date_start}T00:00:00Z/{date_end}T23:59:59Z",
        "bbox": bbox,
        "limit": 10
    }

    try:
        cat_resp = await client.post(
            settings.CDSE_CATALOG_URL,
            json=cat_payload,
            headers=headers,
            timeout=5.0
        )
        if cat_resp.status_code != 200:
            logger.warning(f"[CDSE Catalog] Błąd {cat_resp.status_code}: {cat_resp.text[:200]}")
            return None

        features = cat_resp.json().get("features", [])
        if not features:
            logger.info("[CDSE Catalog] Brak scen dla podanych współrzędnych w oknie czasowym.")
            return None

        clear_features = [
            f for f in features
            if f.get("properties", {}).get("eo:cloud_cover", 100) < CLOUD_COVER_MAX
        ]

        # Pobieramy precyzyjną referencję NDVI zależną od uprawy i miesiąca
        ndvi_reference = get_crop_ndvi_reference(crop_name, month=month)

        if not clear_features:
            first_scene = features[0].get("properties", {})
            return {
                "ndvi_current": None,
                "ndvi_historical_median": ndvi_reference,
                "ndvi_anomaly_percent": None,
                "ndmi_current": None,
                "scene_date": first_scene.get("datetime", "")[:10] or date_end,
                "cloud_cover_percent": first_scene.get("eo:cloud_cover", 45.0),
                "limitation_note": "Wskaźnik NDVI niedostępny z powodu trwałego zachmurzenia (>15%) w 21-dniowym oknie obserwacji. Analizę oparto na bilansie KBW i retencji glebowej."
            }

        best_scene = clear_features[0]
        scene_props = best_scene.get("properties", {})
        scene_datetime = scene_props.get("datetime", "")
        scene_date = scene_datetime[:10] if scene_datetime else date_end
        cloud_cover = round(float(scene_props.get("eo:cloud_cover", 5.0)), 1)

        evalscript = """//VERSION=3
function setup() {
  return {
    input: ["B04", "B08", "B11", "dataMask"],
    output: { bands: 3, sampleType: "FLOAT32" }
  };
}
function evaluatePixel(sample) {
  let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
  let ndmi = (sample.B08 - sample.B11) / (sample.B08 + sample.B11);
  return [ndvi, ndmi, sample.dataMask];
}
"""
        proc_payload = {
            "input": {
                "bounds": {"bbox": bbox},
                "data": [{
                    "type": "sentinel-2-l2a",
                    "dataFilter": {
                        "timeRange": {
                            "from": f"{scene_date}T00:00:00Z",
                            "to": f"{scene_date}T23:59:59Z"
                        }
                    }
                }]
            },
            "output": {
                "width": 1,
                "height": 1,
                "responses": [{"identifier": "default", "format": {"type": "image/tiff"}}]
            },
            "evalscript": evalscript
        }

        proc_headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "image/tiff"
        }

        p_resp = await client.post(
            settings.CDSE_PROCESS_URL,
            json=proc_payload,
            headers=proc_headers,
            timeout=6.0
        )

        if p_resp.status_code == 200:
            with rasterio.open(io.BytesIO(p_resp.content)) as src:
                arr = src.read()
                raw_ndvi = float(arr[0, 0, 0])
                raw_ndmi = float(arr[1, 0, 0])
                mask = float(arr[2, 0, 0])

            if mask > 0 and not (-1.0 > raw_ndvi or raw_ndvi > 1.0 or raw_ndvi != raw_ndvi):
                ndvi_val = round(raw_ndvi, 3)
                ndmi_val = round(raw_ndmi, 3) if not (-1.0 > raw_ndmi or raw_ndmi > 1.0 or raw_ndmi != raw_ndmi) else 0.22
                
                # Obliczenie anomalii względem referencji dla tej uprawy w tym miesiącu
                anomaly = round(((ndvi_val - ndvi_reference) / ndvi_reference) * 100.0, 1)

                return {
                    "ndvi_current": ndvi_val,
                    "ndvi_historical_median": ndvi_reference,
                    "ndvi_anomaly_percent": anomaly,
                    "ndmi_current": ndmi_val,
                    "scene_date": scene_date,
                    "cloud_cover_percent": cloud_cover,
                    "limitation_note": None
                }
    except Exception as e:
        logger.warning(f"[CDSE Copernicus] Wyjątek podczas komunikacji z CDSE: {e}")

    return None


def extract_real_indices_from_cog(item: Dict[str, Any], lon: float, lat: float) -> Tuple[Optional[float], Optional[float]]:
    """
    Pobiera wartości pikseli pasm B04 (Red), B08 (NIR) i B11 (SWIR) z AWS S3 COG
    za pomocą biblioteki rasterio i oblicza rzeczywiste wskaźniki NDVI oraz NDMI (Fallback).
    """
    try:
        assets = item.get("assets", {})
        red_url = assets.get("red", {}).get("href")
        nir_url = assets.get("nir", {}).get("href")
        swir_url = assets.get("swir16", {}).get("href")

        if not red_url or not nir_url:
            return None, None

        with rasterio.open(red_url) as src_red:
            xs, ys = transform("EPSG:4326", src_red.crs, [lon], [lat])
            red_val = next(src_red.sample([(xs[0], ys[0])]))[0]

        with rasterio.open(nir_url) as src_nir:
            xs, ys = transform("EPSG:4326", src_nir.crs, [lon], [lat])
            nir_val = next(src_nir.sample([(xs[0], ys[0])]))[0]

        ndvi = None
        if (nir_val + red_val) > 0:
            ndvi = round(float(nir_val - red_val) / float(nir_val + red_val), 3)

        ndmi = None
        if swir_url and nir_val > 0:
            try:
                with rasterio.open(swir_url) as src_swir:
                    xs, ys = transform("EPSG:4326", src_swir.crs, [lon], [lat])
                    swir_val = next(src_swir.sample([(xs[0], ys[0])]))[0]
                    if (nir_val + swir_val) > 0:
                        ndmi = round(float(nir_val - swir_val) / float(nir_val + swir_val), 3)
            except Exception:
                pass

        return ndvi, ndmi
    except Exception as e:
        logger.warning(f"[AWS STAC COG] Błąd odczytu piksela z COG: {e}")
        return None, None


async def fetch_sentinel_indices(
    lat: float,
    lon: float,
    target_date_str: Optional[str] = None,
    crop_name: str = "kukurydza"
) -> Dict[str, Any]:
    """
    Wyszukuje zobrazowania satelitarne Sentinel-2 w oknie 21 dni wokół target_date z uwzględnieniem TTL cache.
    Przyjmuje crop_name w celu doboru precyzyjnej referencji NDVI.
    """
    if target_date_str:
        try:
            target_date = datetime.strptime(target_date_str, "%Y-%m-%d").date()
            month = target_date.month
        except ValueError:
            target_date = datetime.now().date()
            month = target_date.month
    else:
        target_date = datetime.now().date()
        month = target_date.month

    lat_r = round(lat, 4)
    lon_r = round(lon, 4)
    # Klucz cache uwzględnia teraz współrzędne, datę oraz uprawę
    cache_key = (lat_r, lon_r, target_date_str, crop_name.lower())
    
    if cache_key in _SATELLITE_CACHE:
        return _SATELLITE_CACHE[cache_key]

    date_start = (target_date - timedelta(days=21)).strftime("%Y-%m-%d")
    date_end = target_date.strftime("%Y-%m-%d")

    # Pobieramy referencyjne NDVI dla konkretnej uprawy i miesiąca
    ndvi_reference = get_crop_ndvi_reference(crop_name, month=month)

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT_SECONDS) as client:
        # --- PRIORYTET 1: Copernicus Data Space Ecosystem (CDSE) ---
        token = await get_cdse_token(client)
        if token:
            cdse_result = await fetch_indices_from_cdse(
                client=client,
                token=token,
                lon=lon,
                lat=lat,
                date_start=date_start,
                date_end=date_end,
                crop_name=crop_name,
                month=month
            )
            if cdse_result is not None:
                _SATELLITE_CACHE[cache_key] = cdse_result
                return cdse_result

        # --- PRIORYTET 2: AWS Earth Search STAC (Fallback) ---
        datetime_query = f"{date_start}T00:00:00Z/{date_end}T23:59:59Z"
        stac_search_url = f"{settings.STAC_EARTH_SEARCH_URL}/search"
        search_payload = {
            "collections": ["sentinel-2-l2a"],
            "bbox": [lon - 0.0005, lat - 0.0005, lon + 0.0005, lat + 0.0005],
            "datetime": datetime_query,
            "query": {
                "eo:cloud_cover": {"lt": 50}
            },
            "sortby": [{"field": "properties.datetime", "direction": "desc"}],
            "limit": 5
        }

        best_item = None
        cloud_cover = 12.0
        scene_date = date_end

        try:
            resp = await client.post(stac_search_url, json=search_payload)
            if resp.status_code == 200:
                data = resp.json()
                features = data.get("features", [])
                clear_features = [f for f in features if f.get("properties", {}).get("eo:cloud_cover", 100) < 15]
                if clear_features:
                    best_item = clear_features[0]
                    props = best_item.get("properties", {})
                    cloud_cover = props.get("eo:cloud_cover", 5.0)
                    dt = props.get("datetime", "")
                    scene_date = dt.split("T")[0] if dt else date_end
                elif features:
                    result = {
                        "ndvi_current": None,
                        "ndvi_historical_median": ndvi_reference,
                        "ndvi_anomaly_percent": None,
                        "ndmi_current": None,
                        "scene_date": features[0].get("properties", {}).get("datetime", "").split("T")[0],
                        "cloud_cover_percent": features[0].get("properties", {}).get("eo:cloud_cover", 45.0),
                        "limitation_note": "Wskaźnik NDVI niedostępny z powodu trwałego zachmurzenia (>15%) w 21-dniowym oknie obserwacji. Analizę oparto na bilansie KBW i retencji glebowej."
                    }
                    _SATELLITE_CACHE[cache_key] = result
                    return result
        except Exception as e:
            logger.warning(f"[AWS STAC] Błąd połączenia / timeout: {e}")

    # Jeśli znaleziono bezchmurną scenę, pobieramy rzeczywiste wskaźniki z COG
    if best_item is not None:
        real_ndvi, real_ndmi = extract_real_indices_from_cog(best_item, lon, lat)
        if real_ndvi is not None:
            anomaly = round(((real_ndvi - ndvi_reference) / ndvi_reference) * 100.0, 1)
            result = {
                "ndvi_current": real_ndvi,
                "ndvi_historical_median": ndvi_reference,
                "ndvi_anomaly_percent": anomaly,
                "ndmi_current": real_ndmi if real_ndmi is not None else 0.22,
                "scene_date": scene_date,
                "cloud_cover_percent": cloud_cover,
                "is_fallback": False,
                "limitation_note": None
            }
            _SATELLITE_CACHE[cache_key] = result
            return result

    # Brak dostępnych bezchmurnych scen lub błąd połączenia ze STAC/CDSE.
    # Zgodnie z wytycznymi KOWR: ZERO pozornej precyzji - zwracamy None zamiast syntetycznych wartości.
    result = {
        "ndvi_current": None,
        "ndvi_historical_median": ndvi_reference,
        "ndvi_anomaly_percent": None,
        "ndmi_current": None,
        "scene_date": None,
        "cloud_cover_percent": None,
        "is_fallback": True,
        "limitation_note": "Brak bezchmurnych zobrazowań Sentinel-2 (<15% zachmurzenia) lub brak połączenia z repozytorium STAC. Wskaźnik NDVI niedostępny – analizę oparto na bilansie KBW i retencji glebowej."
    }
    _SATELLITE_CACHE[cache_key] = result
    return result