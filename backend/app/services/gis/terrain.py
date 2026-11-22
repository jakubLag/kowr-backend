"""
Moduł analizy rzeźby terenu, hydrografii i elementów krajobrazowych
(Open-Meteo Elevation DEM + Geoportal NMT + IMGW-PIB Hydro + OpenStreetMap Overpass API).

Zgodnie z wytycznymi KOWR wyznacza:
- Średnie nachylenie stoku (%) oraz kierunek spływu powierzchniowego (aspect_direction) z 5-punktowego DEM
- Dokładną odległość oraz geometrię najbliższego rowu melioracyjnego lub cieku (bufor 500 m, Overpass API)
- Obecność oczek wodnych / zbiorników / mokradeł (bufor 500 m) oraz zadrzewień śródpolnych / żywopłotów (bufor 300 m)
- Najbliższą rzekę i stan wód z lokalnej bazy stacji hydrologicznych IMGW-PIB (czas < 1 ms)
- Brak cichych fallbacków (brak obiektów -> None, błąd DEM/Overpass -> None + jawny wpis w limitations).
"""

import os
import json
import math
import asyncio
import logging
from typing import Dict, Any, Optional, Tuple, List
import httpx
from cachetools import TTLCache
from app.core.config import settings
from app.services.gis.coordinates import transform_4326_to_2180

logger = logging.getLogger("terrain")

_TERRAIN_CACHE: TTLCache = TTLCache(maxsize=500, ttl=86400)
_IMGW_STATIONS_CACHE: List[Dict[str, Any]] = []

IMGW_LOCAL_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "imgw_stations.json")

WATERWAY_TYPES = {"ditch", "drain", "stream", "canal", "river"}
OVERPASS_TIMEOUT_SECONDS = 6.0
DEM_STEP_METERS = 50.0
OPEN_METEO_ELEVATION_TIMEOUT_SECONDS = 5.0
OVERPASS_HEADERS = {
    "User-Agent": "KOWR-ContraSusza/1.0 (HackNation 2026; https://contrasusza.vercel.app)",
    "Accept": "application/json",
}

_ASPECT_COMPASS_PL = [
    "północny",
    "północno-wschodni",
    "wschodni",
    "południowo-wschodni",
    "południowy",
    "południowo-zachodni",
    "zachodni",
    "północno-zachodni",
]


def _compute_slope_and_aspect(
    h_n: float,
    h_s: float,
    h_e: float,
    h_w: float,
    step_m: float = DEM_STEP_METERS,
) -> Tuple[float, str]:
    """
    Oblicza nachylenie terenu w % oraz główny kierunek spływu powierzchniowego (w dół stoku)
    na podstawie różnic centralnych z punktów N, S, E, W oddalonych o `step_m` od środka działki.
    """
    span_m = 2.0 * step_m
    dz_dy = (h_n - h_s) / span_m
    dz_dx = (h_e - h_w) / span_m
    slope_percent = round(math.hypot(dz_dx, dz_dy) * 100.0, 1)
    slope_percent = max(0.0, min(60.0, slope_percent))

    if slope_percent < 0.2:
        return slope_percent, "teren płaski"

    # Wektor spływu w dół stoku: (-dz_dx, -dz_dy)
    azimuth_deg = (math.degrees(math.atan2(-dz_dx, -dz_dy)) + 360.0) % 360.0
    sector = int(((azimuth_deg + 22.5) % 360.0) // 45.0)
    return slope_percent, _ASPECT_COMPASS_PL[sector]


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Oblicza odległość w metrach między dwoma punktami WGS84."""
    r = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2.0) ** 2
    )
    return 2.0 * r * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def _point_to_segment_distance_m(
    plat: float,
    plon: float,
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
) -> Tuple[float, float, float]:
    """
    Wyznacza najkrótszą odległość (m) punktu (plat, plon) do odcinka (lat1, lon1)-(lat2, lon2)
    oraz zwraca współrzędne (lat, lon) najbliższego punktu na tym odcinku.
    """
    cos_lat = math.cos(math.radians(plat))
    m_per_deg_lat = 111320.0
    m_per_deg_lon = 111320.0 * max(0.1, cos_lat)

    x1 = (lon1 - plon) * m_per_deg_lon
    y1 = (lat1 - plat) * m_per_deg_lat
    x2 = (lon2 - plon) * m_per_deg_lon
    y2 = (lat2 - plat) * m_per_deg_lat

    dx = x2 - x1
    dy = y2 - y1
    seg_len_sq = dx * dx + dy * dy

    if seg_len_sq <= 1e-9:
        return math.hypot(x1, y1), lat1, lon1

    t = max(0.0, min(1.0, -(x1 * dx + y1 * dy) / seg_len_sq))
    proj_x = x1 + t * dx
    proj_y = y1 + t * dy
    closest_lat = lat1 + t * (lat2 - lat1)
    closest_lon = lon1 + t * (lon2 - lon1)
    return math.hypot(proj_x, proj_y), closest_lat, closest_lon


def _build_overpass_query(lat: float, lon: float) -> str:
    """
    Buduje pojedyncze zapytanie Overpass QL (timeout 4 s) pobierające:
    - cieki i rowy w buforze 500 m,
    - oczka wodne, zbiorniki i mokradła w buforze 500 m,
    - zadrzewienia śródpolne i żywopłoty w buforze 300 m.
    """
    lat_r = round(lat, 6)
    lon_r = round(lon, 6)
    return (
        f"[out:json][timeout:{int(OVERPASS_TIMEOUT_SECONDS)}];\n"
        "(\n"
        f'  way["waterway"~"ditch|drain|stream|canal|river"](around:500,{lat_r},{lon_r});\n'
        f'  way["natural"~"water|wetland"](around:500,{lat_r},{lon_r});\n'
        f'  relation["natural"~"water|wetland"](around:500,{lat_r},{lon_r});\n'
        f'  way["natural"~"tree_row|wood"](around:300,{lat_r},{lon_r});\n'
        f'  way["barrier"="hedge"](around:300,{lat_r},{lon_r});\n'
        ");\n"
        "out geom;\n"
    )


def _parse_overpass_elements(
    elements: List[Dict[str, Any]],
    lat: float,
    lon: float,
) -> Dict[str, Any]:
    """Parsuje odpowiedź Overpass API (out geom) i wyznacza parametry hydrologiczno-krajobrazowe."""
    best_dist_m: Optional[float] = None
    nearest_waterway_coords: Optional[List[List[float]]] = None
    nearest_waterway_point: Optional[List[float]] = None
    nearest_waterway_type: Optional[str] = None
    has_wetland_or_pond_nearby = False
    has_windbreak_nearby = False

    for elem in elements:
        tags = elem.get("tags") or {}
        waterway_tag = tags.get("waterway")
        natural_tag = tags.get("natural")
        barrier_tag = tags.get("barrier")

        if natural_tag in ("water", "wetland"):
            has_wetland_or_pond_nearby = True

        if natural_tag in ("tree_row", "wood") or barrier_tag == "hedge":
            has_windbreak_nearby = True

        if waterway_tag in WATERWAY_TYPES:
            geom = elem.get("geometry") or []
            coords: List[List[float]] = []
            for pt in geom:
                pt_lat = pt.get("lat")
                pt_lon = pt.get("lon")
                if pt_lat is not None and pt_lon is not None:
                    coords.append([float(pt_lat), float(pt_lon)])

            if not coords:
                continue

            elem_min_dist = float("inf")
            elem_closest_pt: Optional[List[float]] = None

            if len(coords) == 1:
                d = _haversine_m(lat, lon, coords[0][0], coords[0][1])
                elem_min_dist = d
                elem_closest_pt = [round(coords[0][0], 6), round(coords[0][1], 6)]
            else:
                for i in range(len(coords) - 1):
                    d, clat, clon = _point_to_segment_distance_m(
                        lat,
                        lon,
                        coords[i][0],
                        coords[i][1],
                        coords[i + 1][0],
                        coords[i + 1][1],
                    )
                    if d < elem_min_dist:
                        elem_min_dist = d
                        elem_closest_pt = [round(clat, 6), round(clon, 6)]

            if elem_min_dist < float("inf") and (
                best_dist_m is None or elem_min_dist < best_dist_m
            ):
                best_dist_m = elem_min_dist
                nearest_waterway_coords = [
                    [round(c[0], 6), round(c[1], 6)] for c in coords
                ]
                nearest_waterway_point = elem_closest_pt
                nearest_waterway_type = waterway_tag

    return {
        "distance_to_ditch_m": round(best_dist_m, 1) if best_dist_m is not None else None,
        "hydro_data_available": True,
        "hydro_limitation": None,
        "nearest_waterway_coords": nearest_waterway_coords,
        "nearest_waterway_point": nearest_waterway_point,
        "nearest_waterway_type": nearest_waterway_type,
        "has_wetland_or_pond_nearby": has_wetland_or_pond_nearby,
        "has_windbreak_nearby": has_windbreak_nearby,
    }


async def query_overpass_hydro_and_landscape(
    client: httpx.AsyncClient,
    lat: float,
    lon: float,
) -> Dict[str, Any]:
    """
    Odpytuje Overpass API (z rezerwowym mirrorem overpass.private.coffee i limitem 4 s)
    o cieki/rowy (500 m), oczka/mokradła (500 m) oraz zadrzewienia śródpolne (300 m).

    Brak cichych fallbacków:
    - 0 obiektów -> distance_to_ditch_m=None, hydro_data_available=True
    - błąd / timeout na wszystkich mirrorach -> distance_to_ditch_m=None, hydro_data_available=False + hydro_limitation.
    """
    query = _build_overpass_query(lat, lon)
    mirrors = [settings.OVERPASS_API_URL, settings.OVERPASS_FALLBACK_URL]
    last_error: Optional[str] = None

    for mirror_url in mirrors:
        if not mirror_url:
            continue
        try:
            resp = await client.post(
                mirror_url,
                data={"data": query},
                headers=OVERPASS_HEADERS,
                timeout=OVERPASS_TIMEOUT_SECONDS,
            )
            if resp.status_code == 200:
                payload = resp.json()
                elements = payload.get("elements")
                if isinstance(elements, list):
                    return _parse_overpass_elements(elements, lat, lon)
                last_error = f"Nieprawidłowa struktura odpowiedzi z {mirror_url}"
            else:
                last_error = f"HTTP {resp.status_code} z {mirror_url}"
                logger.warning(f"[Overpass] {last_error}")
        except Exception as e:
            last_error = f"{type(e).__name__}: {e}"
            logger.warning(f"[Overpass] Błąd dla mirroru {mirror_url}: {last_error}")

    logger.warning(f"[Overpass] Wszystkie mirrory niedostępne ({last_error})")
    return {
        "distance_to_ditch_m": None,
        "hydro_data_available": False,
        "hydro_limitation": (
            "Usługa hydrograficzna OpenStreetMap (Overpass API) była chwilowo niedostępna — "
            "nie zweryfikowano obecności rowów melioracyjnych, oczek wodnych ani zadrzewień śródpolnych w otoczeniu działki."
        ),
        "nearest_waterway_coords": None,
        "nearest_waterway_point": None,
        "nearest_waterway_type": None,
        "has_wetland_or_pond_nearby": None,
        "has_windbreak_nearby": None,
    }


async def fetch_elevation_point_gugik(
    client: httpx.AsyncClient, northing: float, easting: float
) -> Optional[float]:
    """Pobiera wysokość n.p.m. dla punktu z Numerycznego Modelu Terenu (GUGiK NMT)."""
    url = f"{settings.GUGIK_NMT_URL}?request=GetHbyXY&x={round(northing, 1)}&y={round(easting, 1)}"
    try:
        resp = await client.get(url, timeout=2.0, follow_redirects=True)
        if resp.status_code == 200:
            text = resp.text.strip().split("\n")[0].strip()
            return float(text)
    except Exception as e:
        logger.debug(f"[GUGiK NMT] Usługa NMT niedostępna ({type(e).__name__}): {e}")
    return None


async def fetch_slope_and_aspect_from_dem(
    client: httpx.AsyncClient,
    lat: float,
    lon: float,
    step_m: float = DEM_STEP_METERS,
) -> Dict[str, Any]:
    """
    Próbkuje 5 punktów DEM (środek + N, S, E, W przesunięte o ~50 m) i oblicza:
    - slope_percent = round(math.hypot(dz_dx, dz_dy) * 100.0, 1)
    - aspect_direction (np. 'południowo-zachodni')

    Priorytet:
    1. Open-Meteo Elevation API (1 zapytanie z listą 5 par współrzędnych, ~200 ms)
    2. Fallback: GUGiK NMT (5 punktów równolegle)
    3. Brak odpowiedzi z obu źródeł -> slope_percent=None, dem_available=False + jawny wpis w limitations (nigdy 1.8%).
    """
    dlat = step_m / 111320.0
    dlon = step_m / (111320.0 * max(0.1, math.cos(math.radians(lat))))

    sample_points = [
        (lat, lon),               # 0: środek
        (lat + dlat, lon),        # 1: N (+50 m)
        (lat - dlat, lon),        # 2: S (-50 m)
        (lat, lon + dlon),        # 3: E (+50 m)
        (lat, lon - dlon),        # 4: W (-50 m)
    ]

    # 1. Open-Meteo Elevation API (1 zbiorcze zapytanie dla 5 punktów)
    try:
        lats_param = ",".join(f"{p[0]:.6f}" for p in sample_points)
        lons_param = ",".join(f"{p[1]:.6f}" for p in sample_points)
        resp = await client.get(
            settings.OPEN_METEO_ELEVATION_URL,
            params={"latitude": lats_param, "longitude": lons_param},
            timeout=OPEN_METEO_ELEVATION_TIMEOUT_SECONDS,
        )
        if resp.status_code == 200:
            payload = resp.json()
            elevations = payload.get("elevation")
            if (
                isinstance(elevations, list)
                and len(elevations) == 5
                and all(isinstance(v, (int, float)) and not math.isnan(v) for v in elevations)
            ):
                slope_pct, aspect_dir = _compute_slope_and_aspect(
                    h_n=float(elevations[1]),
                    h_s=float(elevations[2]),
                    h_e=float(elevations[3]),
                    h_w=float(elevations[4]),
                    step_m=step_m,
                )
                return {
                    "slope_percent": slope_pct,
                    "aspect_direction": aspect_dir,
                    "dem_source": "Open-Meteo Elevation DEM",
                    "dem_available": True,
                    "dem_limitation": None,
                }
        else:
            logger.warning(f"[Open-Meteo Elevation] Błąd HTTP {resp.status_code}")
    except Exception as e:
        logger.warning(f"[Open-Meteo Elevation] Błąd połączenia / timeout: {e}")

    # 2. Fallback: Geoportal / GUGiK NMT (5 punktów równolegle w układzie EPSG:2180)
    try:
        northing, easting = transform_4326_to_2180(lon, lat)
        gugik_tasks = [
            fetch_elevation_point_gugik(client, northing, easting),
            fetch_elevation_point_gugik(client, northing + step_m, easting),
            fetch_elevation_point_gugik(client, northing - step_m, easting),
            fetch_elevation_point_gugik(client, northing, easting + step_m),
            fetch_elevation_point_gugik(client, northing, easting - step_m),
        ]
        elevs = await asyncio.gather(*gugik_tasks, return_exceptions=True)
        if all(isinstance(v, (int, float)) and not math.isnan(v) for v in elevs):
            slope_pct, aspect_dir = _compute_slope_and_aspect(
                h_n=float(elevs[1]),
                h_s=float(elevs[2]),
                h_e=float(elevs[3]),
                h_w=float(elevs[4]),
                step_m=step_m,
            )
            return {
                "slope_percent": slope_pct,
                "aspect_direction": aspect_dir,
                "dem_source": "Geoportal NMT (GUGiK)",
                "dem_available": True,
                "dem_limitation": None,
            }
    except Exception as e:
        logger.warning(f"[GUGiK NMT] Błąd obliczania spadku: {e}")

    # 3. Brak danych DEM -> None + jawne ograniczenie (nigdy zahardkodowane 1.8%)
    logger.warning("[DEM] Brak dostępnych danych wysokościowych (Open-Meteo Elevation i GUGiK NMT niedostępne).")
    return {
        "slope_percent": None,
        "aspect_direction": None,
        "dem_source": None,
        "dem_available": False,
        "dem_limitation": (
            "Dane wysokościowe terenu (DEM: Open-Meteo Elevation / GUGiK NMT) były chwilowo niedostępne — "
            "nie wyznaczono spadku terenu ani kierunku spływu powierzchniowego."
        ),
    }


async def get_imgw_stations(client: Optional[httpx.AsyncClient] = None) -> List[Dict[str, Any]]:
    """
    Pobiera i buforuje w pamięci listę państwowych stacji hydrologicznych IMGW-PIB.
    W pierwszej kolejności czyta lokalną bazę JSON (czas odpowiedzi < 1 ms),
    a w przypadku jej braku odpytuje API IMGW z limitem 2.0s.
    """
    global _IMGW_STATIONS_CACHE
    if _IMGW_STATIONS_CACHE:
        return _IMGW_STATIONS_CACHE

    candidate_paths = [
        IMGW_LOCAL_PATH,
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "imgw_data_slim.json"),
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "imgw_stations.json"),
    ]

    for p in candidate_paths:
        if os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    _IMGW_STATIONS_CACHE = json.load(f)
                    if _IMGW_STATIONS_CACHE:
                        logger.info(f"[IMGW Hydro] Załadowano {len(_IMGW_STATIONS_CACHE)} stacji z lokalnego pliku: {p}")
                        return _IMGW_STATIONS_CACHE
            except Exception as e:
                logger.debug(f"[IMGW Hydro] Błąd odczytu lokalnej bazy stacji ({p}): {e}")

    if client:
        try:
            resp = await client.get(settings.IMGW_HYDRO_URL, timeout=2.0)
            if resp.status_code == 200:
                _IMGW_STATIONS_CACHE = resp.json()
                return _IMGW_STATIONS_CACHE
        except Exception as e:
            logger.debug(f"[IMGW Hydro] Błąd pobierania stacji z API: {e}")
    return []


async def fetch_terrain_and_hydro(
    lat: float,
    lon: float,
    ditch_distance_m: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Analizuje spadek terenu (5-punktowy Open-Meteo Elevation / GUGiK NMT), najbliższą stację rzeki IMGW-PIB
    oraz hydrografię i krajobraz w otoczeniu działki (Overpass API: cieki/rowy 500 m, oczka/mokradła 500 m, zadrzewienia 300 m).

    Priorytet odległości do rowu:
    1. Jawnie podana odległość rolnika / z mapy (ditch_distance_m)
    2. Rzeczywisty wynik z Overpass API (cieki/rowy w buforze 500 m)
    3. Brak cieków lub niedostępność API -> None (bez pozornej precyzji 120 m / 450 m).
    """
    ditch_key = round(ditch_distance_m, 1) if ditch_distance_m is not None else None
    cache_key = (round(lat, 4), round(lon, 4), ditch_key)
    if cache_key in _TERRAIN_CACHE:
        return _TERRAIN_CACHE[cache_key]

    nearest_river = None
    water_level_cm = None
    river_distance_m = None

    async with httpx.AsyncClient(timeout=OVERPASS_TIMEOUT_SECONDS) as client:
        dem_task = fetch_slope_and_aspect_from_dem(client, lat, lon)
        stations_task = get_imgw_stations(client)
        overpass_task = query_overpass_hydro_and_landscape(client, lat, lon)

        dem_data, stations, overpass_data = await asyncio.gather(
            dem_task, stations_task, overpass_task
        )

        if stations:
            min_dist = float("inf")
            best_station = None
            for s in stations:
                try:
                    slat = float(s["lat"])
                    slon = float(s["lon"])
                    dist = _haversine_m(lat, lon, slat, slon)
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

    if ditch_distance_m is not None:
        final_ditch_dist: Optional[float] = max(0.0, round(float(ditch_distance_m), 1))
        hydro_data_available = True
        hydro_limitation = overpass_data.get("hydro_limitation")
    else:
        final_ditch_dist = overpass_data["distance_to_ditch_m"]
        hydro_data_available = overpass_data["hydro_data_available"]
        hydro_limitation = overpass_data["hydro_limitation"]

    result = {
        "slope_percent": dem_data["slope_percent"],
        "aspect_direction": dem_data["aspect_direction"],
        "dem_source": dem_data["dem_source"],
        "dem_available": dem_data["dem_available"],
        "dem_limitation": dem_data["dem_limitation"],
        "is_slope_fallback": not dem_data["dem_available"],
        "distance_to_ditch_m": final_ditch_dist,
        "hydro_data_available": hydro_data_available,
        "hydro_limitation": hydro_limitation,
        "nearest_waterway_coords": overpass_data["nearest_waterway_coords"],
        "nearest_waterway_point": overpass_data["nearest_waterway_point"],
        "nearest_waterway_type": overpass_data["nearest_waterway_type"],
        "has_wetland_or_pond_nearby": overpass_data["has_wetland_or_pond_nearby"],
        "has_windbreak_nearby": overpass_data["has_windbreak_nearby"],
        "nearest_river": nearest_river,
        "river_distance_m": river_distance_m,
        "water_level_cm": water_level_cm,
    }

    # Cachujemy tylko pełne odpowiedzi, aby przejściowy timeout DEM/Overpass nie został utrwalony
    if hydro_data_available and dem_data["dem_available"]:
        _TERRAIN_CACHE[cache_key] = result

    return result
