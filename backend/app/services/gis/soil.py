"""
Klient ISRIC SoilGrids REST API.
Pobiera uziarnienie (piasek, pył, ił) oraz zawartość węgla organicznego (SOC) dla warstwy 0-30 cm.
Wykorzystuje równania Saxtona & Rawlsa do estymacji Polowej Pojemności Wodnej (AWC).
"""

from typing import Dict, Any, Tuple
import httpx
from cachetools import TTLCache
from app.core.config import settings
from app.services.science.saxton_rawls import calculate_saxton_rawls_awc

_SOIL_CACHE: TTLCache = TTLCache(maxsize=500, ttl=86400)

async def fetch_soil_properties(lat: float, lon: float) -> Dict[str, Any]:
    """
    Pobiera frakcje glebowe z SoilGrids v2.0 dla współrzędnych.
    Używa pamięci podręcznej (cache), aby nie odpytywać API wielokrotnie dla tego samego pola.
    """
    cache_key = (round(lat, 3), round(lon, 3))
    if cache_key in _SOIL_CACHE:
        return _SOIL_CACHE[cache_key]
    params = {
        "lat": round(lat, 4),
        "lon": round(lon, 4),
        "property": ["sand", "silt", "clay", "soc"],
        "depth": ["0-5cm", "5-15cm", "15-30cm"],
        "value": "mean"
    }

    sand_pct = 62.0  # domyślnie piasek gliniasty
    clay_pct = 12.0
    silt_pct = 26.0
    soc_pct = 1.4
    is_fallback = True

    try:
        soil_timeout = max(10.0, settings.SERVICE_TIMEOUT_SECONDS)
        async with httpx.AsyncClient(timeout=soil_timeout) as client:
            resp = await client.get(settings.SOILGRIDS_BASE_URL, params=params)
            if resp.status_code == 200:
                data = resp.json()
                layers = data.get("properties", {}).get("layers", [])
                
                layer_map = {l.get("name"): l for l in layers}
                
                def extract_mean(layer_name: str, factor: float = 0.1) -> float:
                    layer = layer_map.get(layer_name)
                    if not layer:
                        return None
                    depths = layer.get("depths", [])
                    values = [d.get("values", {}).get("mean") for d in depths if d.get("values", {}).get("mean") is not None]
                    if values:
                        return (sum(values) / len(values)) * factor
                    return None

                s = extract_mean("sand", 0.1)  # w g/kg -> zamiana na %
                c = extract_mean("clay", 0.1)
                si = extract_mean("silt", 0.1)
                soc = extract_mean("soc", 0.01)  # dg/kg -> zamiana na %

                if s is not None and c is not None:
                    sand_pct = s
                    clay_pct = c
                    silt_pct = si if si is not None else (100.0 - sand_pct - clay_pct)
                    soc_pct = soc if soc is not None else 1.4
                    is_fallback = False
    except Exception as e:
        print(f"Error api soil {type(e)}")

    # Obliczenie Saxton & Rawls
    retention_data = calculate_saxton_rawls_awc(
        sand_percent=sand_pct,
        clay_percent=clay_pct,
        soc_percent=soc_pct,
        layer_thickness_cm=30.0
    )

    result = {
        "sand_percent": round(sand_pct, 1),
        "clay_percent": round(clay_pct, 1),
        "silt_percent": round(silt_pct, 1),
        "soc_percent": round(soc_pct, 2),
        "organic_matter_percent": round(soc_pct * 1.724, 2),
        "is_fallback": is_fallback,
        **retention_data
    }
    # Cachujemy tylko realne odpowiedzi SoilGrids, aby przejściowy timeout nie został utrwalony
    if not is_fallback:
        _SOIL_CACHE[cache_key] = result
    return result

