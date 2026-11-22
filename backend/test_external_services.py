"""
Skrypt do niezależnego testowania każdego z 5 zewnętrznych serwisów danych przestrzennych i meteo.
Uruchomienie: python test_external_services.py
"""

import time
import asyncio
import httpx

from app.services.gis.uldk import fetch_parcel_from_uldk
from app.services.gis.weather import fetch_weather_data
from app.services.gis.satellite import fetch_sentinel_indices
from app.services.gis.soil import fetch_soil_properties
from app.services.gis.terrain import fetch_terrain_and_hydro

async def test_all_services_individually():
    print("=" * 70)
    print(" 🛰️ TESTOWANIE 5 ZEWNĘTRZNYCH SERWISÓW DANYCH KOWR Z OSOBNA")
    print("=" * 70)

    # Działka testowa (Mińsk Mazowiecki)
    teryt = "101502_2.0001.1098"
    lat, lon = 52.101282, 19.727814

    # -------------------------------------------------------------
    # 1. ULDK GUGiK (Granice i powierzchnia działki)
    # -------------------------------------------------------------
    print("\n[1/5] TEST: ULDK GUGiK (Granice działki)")
    t0 = time.time()
    try:
        parcel = await fetch_parcel_from_uldk(teryt)
        dt = (time.time() - t0) * 1000
        print(f"  ✅ Status: OK (czas: {dt:.0f} ms)")
        print(f"  • TERYT:        {parcel.teryt}")
        print(f"  • Powierzchnia: {parcel.area_ha} ha")
        print(f"  • Lokalizacja:  {parcel.voivodeship}, {parcel.county}, {parcel.commune}")
        print(f"  • Centrum:      lat={parcel.center.lat}, lon={parcel.center.lon}")
    except Exception as e:
        print(f"  ❌ Błąd: {e}")

    # -------------------------------------------------------------
    # 2. Open-Meteo API (Opady, temperatura, ewapotranspiracja ET0)
    # -------------------------------------------------------------
    print("\n[2/5] TEST: Open-Meteo API (Pogoda i Penman-Monteith ET0)")
    t0 = time.time()
    try:
        weather = await fetch_weather_data(lat, lon, target_date_str="2026-07-15")
        dt = (time.time() - t0) * 1000
        print(f"  ✅ Status: OK (czas: {dt:.0f} ms) {'[FALLBACK]' if weather.get('is_fallback') else '[LIVE API]'}")
        print(f"  • Opady (30 dni):       {weather['precipitation_30d_mm']} mm")
        print(f"  • Opady (60 dni):       {weather['precipitation_60d_mm']} mm")
        print(f"  • Ewapotranspiracja ET0:{weather['et0_30d_mm']} mm")
        print(f"  • Średnia temperatura:  {weather['mean_temperature_c']} °C")
    except Exception as e:
        print(f"  ❌ Błąd: {e}")

    # -------------------------------------------------------------
    # 3. AWS Earth Search STAC (Satelita Sentinel-2 L2A COG)
    # -------------------------------------------------------------
    print("\n[3/5] TEST: AWS STAC Earth Search (Sentinel-2 L2A)")
    t0 = time.time()
    try:
        sentinel = await fetch_sentinel_indices(lat, lon, target_date_str="2026-07-15")
        dt = (time.time() - t0) * 1000
        print(f"  ✅ Status: OK (czas: {dt:.0f} ms)")
        print(f"  • Wskaźnik NDVI:      {sentinel['ndvi_current']}")
        print(f"  • Mediana wieloletnia: {sentinel['ndvi_historical_median']}")
        print(f"  • Anomalia NDVI:      {sentinel['ndvi_anomaly_percent']}%")
        print(f"  • Wskaźnik NDMI:      {sentinel['ndmi_current']}")
        print(f"  • Data sceny:         {sentinel['scene_date']} (chmury: {sentinel['cloud_cover_percent']}%)")
        if sentinel.get("limitation_note"):
            print(f"  ⚠️ Uwaga (chmury):    {sentinel['limitation_note']}")
    except Exception as e:
        print(f"  ❌ Błąd: {e}")

    # -------------------------------------------------------------
    # 4. ISRIC SoilGrids REST API (Gleba i uziarnienie)
    # -------------------------------------------------------------
    print("\n[4/5] TEST: ISRIC SoilGrids API (Profil glebowy 0-30 cm)")
    t0 = time.time()
    try:
        soil = await fetch_soil_properties(lat, lon)
        dt = (time.time() - t0) * 1000
        print(f"  ✅ Status: OK (czas: {dt:.0f} ms)")
        print(f"  • Frakcje:            piasek: {soil['sand_percent']}%, pył: {soil['silt_percent']}%, ił: {soil['clay_percent']}%")
        print(f"  • Węgiel organiczny:  SOC: {soil['soc_percent']}% (próchnica: {soil['organic_matter_percent']}%)")
        print(f"  • Kategoria gleby:    {soil['soil_category']} ({soil['texture_name']})")
        print(f"  • Polowa Pojemność:   AWC: {soil['awc_mm']} mm (Saxton & Rawls)")
    except Exception as e:
        print(f"  ❌ Błąd: {e}")

    # -------------------------------------------------------------
    # 5. Overpass API / NMT (Rzeźba terenu, rowy i cieki)
    # -------------------------------------------------------------
    print("\n[5/5] TEST: Overpass API / NMT (Spadek terenu i cieki w 500m)")
    t0 = time.time()
    try:
        terrain = await fetch_terrain_and_hydro(lat, lon)
        dt = (time.time() - t0) * 1000
        print(f"  ✅ Status: OK (czas: {dt:.0f} ms)")
        print(f"  • Średni spadek terenu:    {terrain['slope_percent']}%")
        print(f"  • Odległość do rowu/cieku: {terrain['distance_to_ditch_m']} m")
    except Exception as e:
        print(f"  ❌ Błąd: {e}")

    print("\n" + "=" * 70)
    print(" 🎉 Zakończono testowanie każdego z 5 serwisów.")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(test_all_services_individually())
