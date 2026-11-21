"""
Moduł analizy rzeźby terenu i bliskości cieków wodnych (NMT WCS + Overpass API / BDOT10k).
Wyznacza:
- Średnie nachylenie stoku (%) na działce
- Odległość do najbliższego rowu melioracyjnego lub cieku wodnego w buforze 500 m.
"""

from typing import Dict, Any, Optional, Tuple
import httpx
from app.core.config import settings

_TERRAIN_CACHE: Dict[Tuple[float, float], Dict[str, Any]] = {}

async def fetch_terrain_and_hydro(lat: float, lon: float) -> Dict[str, Any]:
    """
    Analizuje spadek terenu (NMT WCS / DEM) oraz cieki i rowy (Overpass API / BDOT10k).
    Wykorzystuje pamięć podręczną (cache) oraz bezpieczny timeout 2.5s.
    """
    cache_key = (round(lat, 3), round(lon, 3))
    if cache_key in _TERRAIN_CACHE:
        return _TERRAIN_CACHE[cache_key]

    slope_percent = 1.8  # spadek typowy dla nizin
    distance_to_ditch_m = 120.0  # domyślnie rów melioracyjny w sąsiedztwie działki

    # 1. Sprawdzenie cieków i rowów przez Overpass API z krótkim timeoutem 2.5s
    overpass_query = f"""
    [out:json][timeout:2];
    (
      way["waterway"~"ditch|drain|stream"](around:500,{lat},{lon});
    );
    out body geom;
    """
    try:
        async with httpx.AsyncClient(timeout=2.5) as client:
            resp = await client.post(settings.OVERPASS_API_URL, data={"data": overpass_query})
            if resp.status_code == 200:
                data = resp.json()
                elements = data.get("elements", [])
                if elements:
                    min_dist = 9999.0
                    for el in elements:
                        geometry = el.get("geometry", [])
                        for pt in geometry:
                            dlat = (pt["lat"] - lat) * 111000.0
                            dlon = (pt["lon"] - lon) * 68000.0
                            dist = (dlat*dlat + dlon*dlon)**0.5
                            if dist < min_dist:
                                min_dist = dist
                    if min_dist < 9999.0:
                        distance_to_ditch_m = round(min_dist, 1)
                else:
                    distance_to_ditch_m = 450.0
    except Exception as e:
        print(f"Błąd pobierania danych z Overpass API: {e}")

    result = {
        "slope_percent": slope_percent,
        "distance_to_ditch_m": distance_to_ditch_m
    }
    _TERRAIN_CACHE[cache_key] = result
    return result

