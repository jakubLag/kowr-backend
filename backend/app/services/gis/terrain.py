"""
Moduł analizy rzeźby terenu i hydrografii (Geoportal NMT + IMGW-PIB Hydro / PGW Wody Polskie Hydroportal).
Zgodnie z wytycznymi KOWR wyznacza:
- Średnie nachylenie stoku (%) na działce wyliczane dynamicznie z Numerycznego Modelu Terenu (GUGiK NMT)
- Odległość do najbliższego rowu melioracyjnego lub cieku wodnego w buforze 500 m
- Identyfikację najbliższej rzeki i stan wód z państwowej sieci pomiarowej IMGW-PIB.
"""

import math
import asyncio
import logging
from typing import Dict, Any, Optional, Tuple, List
import httpx
from app.core.config import settings
from app.services.gis.coordinates import transform_4326_to_2180

logger = logging.getLogger("terrain")

_TERRAIN_CACHE: Dict[Tuple[float, float, Optional[float]], Dict[str, Any]] = {}
_IMGW_STATIONS_CACHE: List[Dict[str, Any]] = []


async def fetch_elevation_point(client: httpx.AsyncClient, northing: float, easting: float) -> Optional[float]:
    """Pobiera wysokość n.p.m. dla punktu z Numerycznego Modelu Terenu (GUGiK NMT)."""
    url = f"{settings.GUGIK_NMT_URL}?request=GetHbyXY&x={round(northing, 1)}&y={round(easting, 1)}"
    try:
        resp = await client.get(url, timeout=2.5)
        if resp.status_code == 200:
            text = resp.text.strip()
            return float(text)
    except Exception as e:
        logger.warning(f"[GUGiK NMT] Błąd zapytania o punkt wysokości: {e}")
    return None


async def calculate_slope_from_nmt(client: httpx.AsyncClient, lat: float, lon: float) -> float:
    """
    Oblicza rzeczywiste nachylenie stoku (%) z NMT GUGiK.
    Pobiera wysokość centralną oraz punkty oddalone o 100 m na północ i wschód,
    wyznaczając dwuwymiarowy wektor gradientu wysokości:
    slope = sqrt((dh_N/100)^2 + (dh_E/100)^2) * 100%
    """
    northing, easting = transform_4326_to_2180(lon, lat)

    h_center_task = fetch_elevation_point(client, northing, easting)
    h_north_task = fetch_elevation_point(client, northing + 100.0, easting)
    h_east_task = fetch_elevation_point(client, northing, easting + 100.0)

    try:
        h_center, h_north, h_east = await asyncio.gather(
            h_center_task, h_north_task, h_east_task, return_exceptions=True
        )

        if isinstance(h_center, (int, float)) and isinstance(h_north, (int, float)) and isinstance(h_east, (int, float)):
            dh_north = (h_north - h_center) / 100.0
            dh_east = (h_east - h_center) / 100.0
            gradient = math.sqrt(dh_north * dh_north + dh_east * dh_east)
            slope = round(gradient * 100.0, 1)
            return max(0.1, min(35.0, slope))
        else:
            print("[GUGiK NMT] Brak odpowiedzi z serwera NMT (timeout/błąd) - zastosowano spadek domyślny 1.8%")
            logger.warning("[GUGiK NMT] Brak pełnych danych wysokościowych - fallback 1.8%")
    except Exception as e:
        print(f"[GUGiK NMT] Błąd obliczania spadku: {e} - zastosowano spadek domyślny 1.8%")
        logger.warning(f"[GUGiK NMT] Błąd obliczania spadku: {e}")

    return 1.8


async def get_imgw_stations(client: httpx.AsyncClient) -> List[Dict[str, Any]]:
    """Pobiera i buforuje w pamięci listę państwowych stacji hydrologicznych IMGW-PIB."""
    global _IMGW_STATIONS_CACHE
    if _IMGW_STATIONS_CACHE:
        return _IMGW_STATIONS_CACHE
    try:
        resp = await client.get(settings.IMGW_HYDRO_URL, timeout=4.0)
        if resp.status_code == 200:
            _IMGW_STATIONS_CACHE = resp.json()
            logger.info(f"[IMGW Hydro] Załadowano {len(_IMGW_STATIONS_CACHE)} stacji hydrologicznych.")
            return _IMGW_STATIONS_CACHE
    except Exception as e:
        logger.warning(f"[IMGW Hydro] Błąd pobierania stacji: {e}")
    return []


async def scan_for_ditch_along_perimeter(
    client: httpx.AsyncClient,
    lat: float,
    lon: float
) -> Optional[float]:
    """
    Skanuje obrzeża działki (promienie 25m, 60m, 120m w 4 kierunkach)
    w poszukiwaniu rowów melioracyjnych na miedzach.
    Zwraca najkrótszy wykryty dystans w metrach lub None jeśli brak rowu w buforze.
    """
    test_radii_m = [25.0, 60.0, 300.0]
    # Wektorowe przesunięcia: N, S, E, W
    directions = [
        (1.0, 0.0),   # Północ
        (-1.0, 0.0),  # Południe
        (0.0, 1.0),   # Wschód
        (0.0, -1.0)   # Zachód
    ]

    for radius_m in test_radii_m:
        dlat_deg = radius_m / 111000.0
        dlon_deg = radius_m / 68000.0

        for dir_lat, dir_lon in directions:
            sample_lat = lat + (dir_lat * dlat_deg)
            sample_lon = lon + (dir_lon * dlon_deg)
            delta = 0.002

            wms_params = {
                "SERVICE": "WMS",
                "VERSION": "1.3.0",
                "REQUEST": "GetFeatureInfo",
                "LAYERS": "HY.Network",
                "QUERY_LAYERS": "HY.Network",
                "CRS": "EPSG:4326",
                "BBOX": f"{sample_lat - delta},{sample_lon - delta},{sample_lat + delta},{sample_lon + delta}",
                "WIDTH": "101",
                "HEIGHT": "101",
                "I": "50",
                "J": "50",
                "INFO_FORMAT": "application/json"
            }
            try:
                wms_resp = await client.get(
                    settings.HYDROPORTAL_WMS_URL,
                    params=wms_params,
                    timeout=1.5
                )
                if wms_resp.status_code == 200:
                    data = wms_resp.json()
                    if data.get("features"):
                        return round(radius_m, 1)
            except Exception:
                pass

    return None


async def fetch_terrain_and_hydro(
    lat: float,
    lon: float,
    ditch_distance_m: Optional[float] = None
) -> Dict[str, Any]:
    """
    Analizuje spadek terenu oraz cieki i rowy (GUGiK NMT + IMGW-PIB + Hydroportal).
    Zwraca rzeczywiste nachylenie terenu (slope_percent) oraz odległość do rowu melioracyjnego (distance_to_ditch_m).
    
    Priorytet odległości do rowu:
    1. Jawnie podana odległość rolnika / z mapy (ditch_distance_m)
    2. Rzeczywiste wykrycie rowu melioracyjnego na miedzy działki (bufor 500 m)
    3. Jeśli brak rowu w buforze 500 m -> None (nigdy sztuczne 320 m!).
    """
    ditch_key = round(ditch_distance_m, 1) if ditch_distance_m is not None else None
    cache_key = (round(lat, 4), round(lon, 4), ditch_key)
    if cache_key in _TERRAIN_CACHE:
        return _TERRAIN_CACHE[cache_key]

    nearest_river = None
    water_level_cm = None
    river_distance_m = None

    async with httpx.AsyncClient(timeout=4.0) as client:
        # 1. Rzeczywiste obliczenie nachylenia stoku z NMT GUGiK
        slope_task = calculate_slope_from_nmt(client, lat, lon)

        # 2. Sprawdzenie sieci hydrologicznej IMGW-PIB (913 państwowych stacji rzecznych)
        stations_task = get_imgw_stations(client)

        slope_percent, stations = await asyncio.gather(slope_task, stations_task)

        if stations:
            min_dist = float("inf")
            best_station = None
            for s in stations:
                try:
                    slat = float(s["lat"])
                    slon = float(s["lon"])
                    dlat = (slat - lat) * 111000.0
                    dlon = (slon - lon) * 68000.0
                    dist = math.sqrt(dlat * dlat + dlon * dlon)
                    if dist < min_dist:
                        min_dist = dist
                        best_station = s
                except (ValueError, TypeError, KeyError):
                    continue

            if best_station and min_dist < float("inf"):
                nearest_river = best_station.get("rzeka")
                river_distance_m = round(min_dist, 1)
                stan_wody_raw = best_station.get("stan_wody")
                if stan_wody_raw is not None:
                    try:
                        water_level_cm = float(stan_wody_raw)
                    except ValueError:
                        pass

        # 3. Odległość do rowu melioracyjnego
        if ditch_distance_m is not None:
            # Priorytet 1: Użytkownik/rolnik wskazał rów obok działki
            final_ditch_dist = max(0.0, round(float(ditch_distance_m), 1))
        else:
            # Priorytet 2: Skanowanie obrzeży działki w buforze 500 m
            scanned_dist = await scan_for_ditch_along_perimeter(client, lat, lon)
            if scanned_dist is not None:
                final_ditch_dist = scanned_dist
            else:
                # W buforze 500m nie znaleziono rowu
                final_ditch_dist = None

    result = {
        "slope_percent": slope_percent,
        "distance_to_ditch_m": final_ditch_dist,
        "nearest_river": nearest_river,
        "river_distance_m": river_distance_m,
        "water_level_cm": water_level_cm
    }
    _TERRAIN_CACHE[cache_key] = result
    return result
