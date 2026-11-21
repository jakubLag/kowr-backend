"""
Moduł analizy rzeźby terenu i hydrografii (Geoportal NMT + IMGW-PIB Hydro / PGW Wody Polskie Hydroportal).
Zgodnie z wytycznymi KOWR wyznacza:
- Średnie nachylenie stoku (%) na działce wyliczane dynamicznie z Numerycznego Modelu Terenu (GUGiK NMT)
- Odległość do najbliższego rowu melioracyjnego lub cieku wodnego w buforze 500 m
- Identyfikację najbliższej rzeki i stan wód z państwowej sieci pomiarowej IMGW-PIB.
"""

import os
import json
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

IMGW_LOCAL_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "imgw_stations.json")

OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
]


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


async def fetch_elevation_open_meteo(client: httpx.AsyncClient, lat: float, lon: float) -> Optional[float]:
    """
    Alternatywne wyznaczenie spadku terenu za pomocą 5-punktowego zapytania do Open-Meteo Elevation API.
    Próbkuje środek oraz punkty oddalone o 100 m na N, S, E, W.
    """
    try:
        dlat = 100.0 / 111000.0
        dlon = 100.0 / (111000.0 * max(0.2, math.cos(math.radians(lat))))
        lats = [lat, lat + dlat, lat - dlat, lat, lat]
        lons = [lon, lon, lon, lon + dlon, lon - dlon]
        lats_str = ",".join(f"{round(x, 5)}" for x in lats)
        lons_str = ",".join(f"{round(x, 5)}" for x in lons)

        url = f"https://api.open-meteo.com/v1/elevation?latitude={lats_str}&longitude={lons_str}"
        resp = await client.get(url, timeout=2.5)
        if resp.status_code == 200:
            elevations = resp.json().get("elevation", [])
            if len(elevations) == 5 and all(isinstance(h, (int, float)) for h in elevations):
                h_c, h_n, h_s, h_e, h_w = elevations
                dh_ns = abs(h_n - h_s) / 200.0
                dh_ew = abs(h_e - h_w) / 200.0
                gradient = math.sqrt(dh_ns * dh_ns + dh_ew * dh_ew)
                slope = round(gradient * 100.0, 1)
                return max(0.1, min(35.0, slope))
    except Exception as e:
        logger.debug(f"[Elevation API] Błąd Open-Meteo Elevation: {e}")
    return None


async def calculate_slope_from_nmt(client: httpx.AsyncClient, lat: float, lon: float) -> Tuple[float, bool]:
    """
    Oblicza rzeczywiste nachylenie stoku (%) z NMT GUGiK lub zapasowo Open-Meteo Elevation.
    Zwraca krotkę (slope_percent, is_fallback).
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
            return max(0.1, min(35.0, slope)), False
    except Exception as e:
        logger.debug(f"[GUGiK NMT] Błąd zapytania NMT: {e}")

    # Próba pobrania z Open-Meteo Elevation API
    elevation_slope = await fetch_elevation_open_meteo(client, lat, lon)
    if elevation_slope is not None:
        return elevation_slope, False

    print("[GUGiK NMT] Brak odpowiedzi z NMT i Elevation API - zastosowano spadek domyślny 1.8% (fallback)")
    return 1.8, True


async def get_imgw_stations(client: httpx.AsyncClient) -> List[Dict[str, Any]]:
    """
    Pobiera i buforuje w pamięci listę państwowych stacji hydrologicznych IMGW-PIB.
    W pierwszej kolejności czyta lokalną bazę JSON (czas odpowiedzi < 1 ms),
    a w przypadku jej braku odpytuje API IMGW z limitem 2.0s.
    """
    global _IMGW_STATIONS_CACHE
    if _IMGW_STATIONS_CACHE:
        return _IMGW_STATIONS_CACHE

    if os.path.exists(IMGW_LOCAL_PATH):
        try:
            with open(IMGW_LOCAL_PATH, "r", encoding="utf-8") as f:
                _IMGW_STATIONS_CACHE = json.load(f)
                if _IMGW_STATIONS_CACHE:
                    logger.info(f"[IMGW Hydro] Załadowano {_IMGW_STATIONS_CACHE.__len__()} stacji z lokalnej bazy.")
                    return _IMGW_STATIONS_CACHE
        except Exception as e:
            logger.debug(f"[IMGW Hydro] Błąd odczytu lokalnej bazy stacji: {e}")

    try:
        resp = await client.get(settings.IMGW_HYDRO_URL, timeout=2.0)
        if resp.status_code == 200:
            _IMGW_STATIONS_CACHE = resp.json()
            return _IMGW_STATIONS_CACHE
    except Exception as e:
        logger.debug(f"[IMGW Hydro] Błąd pobierania stacji z API: {e}")
    return []


async def scan_for_ditch_overpass(
    client: httpx.AsyncClient,
    lat: float,
    lon: float
) -> Tuple[Optional[float], Optional[List[List[float]]]]:
    """
    Skanuje obrzeża działki (bufor 500 m) w poszukiwaniu rowów melioracyjnych i cieków w OpenStreetMap (Overpass API).
    Zwraca krotkę: (najkrótszy dystans w metrach, geometria_najbliższego_rowu).
    """
    query = f"""[out:json][timeout:2];
(
  way["waterway"~"ditch|drain|canal|stream"](around:500,{lat},{lon});
);
out geom;"""

    for mirror_url in OVERPASS_MIRRORS:
        try:
            resp = await client.post(
                mirror_url,
                data={"data": query},
                headers={"User-Agent": "KOWR-WaterApp/1.0"},
                timeout=2.0
            )
            if resp.status_code == 200:
                data = resp.json()
                elements = data.get("elements", [])
                if not elements:
                    return None, None

                min_dist = float("inf")
                best_geom = None
                for el in elements:
                    geom = el.get("geometry", [])
                    for pt in geom:
                        dlat = (pt["lat"] - lat) * 111000.0
                        dlon = (pt["lon"] - lon) * (111000.0 * max(0.2, math.cos(math.radians(lat))))
                        dist = math.sqrt(dlat * dlat + dlon * dlon)
                        if dist < min_dist:
                            min_dist = dist
                            best_geom = [[p["lat"], p["lon"]] for p in geom]

                if min_dist <= 500.0 and best_geom:
                    return round(min_dist, 1), best_geom
                return None, None
        except Exception:
            continue

    return None, None


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

        slope_res, stations = await asyncio.gather(slope_task, stations_task)
        slope_percent, is_slope_fallback = slope_res

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
        ditch_geometry = None
        if ditch_distance_m is not None:
            # Priorytet 1: Użytkownik/rolnik wskazał rów obok działki (z mapy lub suwaka)
            final_ditch_dist = max(0.0, round(float(ditch_distance_m), 1))
        else:
            # Priorytet 2: Skanowanie wektorów cieków i rowów w promieniu 500 m (OpenStreetMap / BDOT10k)
            scanned_dist, ditch_geom = await scan_for_ditch_overpass(client, lat, lon)
            if scanned_dist is not None:
                final_ditch_dist = scanned_dist
                ditch_geometry = ditch_geom
            else:
                final_ditch_dist = None

    result = {
        "slope_percent": slope_percent,
        "is_slope_fallback": is_slope_fallback,
        "distance_to_ditch_m": final_ditch_dist,
        "ditch_geometry": ditch_geometry,
        "nearest_river": nearest_river,
        "river_distance_m": river_distance_m,
        "water_level_cm": water_level_cm
    }
    _TERRAIN_CACHE[cache_key] = result
    return result
