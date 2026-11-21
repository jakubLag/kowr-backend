import time
import asyncio
from datetime import datetime
from fastapi import APIRouter, HTTPException, status

from app.models.schemas import (
    AnalyzeRequest,
    AnalysisResponse,
    Diagnosis,
    ReportMetadata
)
from app.services.gis.uldk import fetch_parcel_from_uldk
from app.services.gis.weather import fetch_weather_data
from app.services.gis.satellite import fetch_sentinel_indices
from app.services.gis.soil import fetch_soil_properties
from app.services.gis.terrain import fetch_terrain_and_hydro

from app.services.science.crops import get_crop_kc
from app.services.science.fao56 import calculate_kbw, evaluate_drought_risk
from app.services.science.decision_engine import evaluate_rules
from app.services.science.report_generator import (
    generate_retention_actions,
    generate_irrigation_recommendation
)

router = APIRouter(prefix="/analyze", tags=["Analiza"])

@router.post("", response_model=AnalysisResponse, status_code=status.HTTP_200_OK)
async def analyze_parcel(request: AnalyzeRequest):
    """
    Główny punkt wejścia analizy KOWR:
    1. Pobiera dane przestrzenne działki (ULDK GUGiK)
    2. Równolegle (asyncio.gather z return_exceptions=True) odpytuje 5 źródeł danych.
    3. Deterministycznie wylicza KBW, AWC Saxtona-Rawlsa, NDVI/NDMI.
    4. Zwraca raport w obowiązkowej sekwencji KOWR wraz z obsługą ograniczeń i fallbacków.
    """
    start_time = time.time()
    
    # 1. Pobranie danych działki z ULDK
    try:
        parcel = await fetch_parcel_from_uldk(request.teryt)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Błąd wyszukiwania działki: {str(e)}")

    lat = parcel.center.lat
    lon = parcel.center.lon

    # Data analizy i współczynnik Kc
    if request.target_date:
        try:
            target_dt = datetime.strptime(request.target_date, "%Y-%m-%d")
            month = target_dt.month
        except ValueError:
            month = 7
    else:
        month = datetime.now().month

    kc = get_crop_kc(request.crop, month=month)

    # 2. Równoległe pobranie pozostałych 4 źródeł danych z return_exceptions=True (Graceful Degradation)
    weather_task = fetch_weather_data(lat, lon, request.target_date)
    sentinel_task = fetch_sentinel_indices(lat, lon, request.target_date, crop_name=request.crop)
    soil_task = fetch_soil_properties(lat, lon)
    terrain_task = fetch_terrain_and_hydro(lat, lon)

    results = await asyncio.gather(
        weather_task,
        sentinel_task,
        soil_task,
        terrain_task,
        return_exceptions=True
    )

    weather_data, sentinel_data, soil_data, terrain_data = results

    # Lista ograniczeń (limitations) i rejestrowanie ewentualnych wyjątków z usług
    limitations = []

    # Bezpieczna obsługa pogody
    if isinstance(weather_data, Exception) or not weather_data:
        limitations.append("Ostrzeżenie: Usługa pogodowa Open-Meteo niedostępna. Użyto awaryjnego modelu meteorologicznego.")
        weather_data = {
            "precipitation_30d_mm": 35.0, "precipitation_60d_mm": 70.0,
            "et0_30d_mm": 110.0, "et0_60d_mm": 210.0, "mean_temperature_c": 19.0,
            "is_fallback": True
        }
    elif weather_data.get("is_fallback"):
        limitations.append("Wykorzystano zastępcze dane meteorologiczne z powodu problemów po stronie dostawcy.")

    # Bezpieczna obsługa satelity
    if isinstance(sentinel_data, Exception) or not sentinel_data:
        limitations.append("Ostrzeżenie: Dane satelitarne Sentinel-2 chwilowo niedostępne. Wskaźniki NDVI/NDMI oszacowano historycznie.")
        sentinel_data = {
            "ndvi_current": 0.55, "ndvi_historical_median": 0.58, "ndvi_anomaly_percent": -5.0,
            "ndmi_current": 0.20, "scene_date": "N/D", "cloud_cover_percent": 0.0,
            "limitation_note": "Brak świeżej sceny satelitarnej (wysokie zachmurzenie lub awaria STAC)."
        }
    elif sentinel_data.get("limitation_note"):
        limitations.append(sentinel_data["limitation_note"])

    # Bezpieczna obsługa gleby
    if isinstance(soil_data, Exception) or not soil_data:
        limitations.append("Ostrzeżenie: ISRIC SoilGrids niedostępne. Zastosowano domyślny profil gleby piaszczysto-gliniastej.")
        soil_data = {
            "soil_category": "średnia", "awc_mm": 120.0, "texture_name": "Gleba średnia (domyślna)"
        }

    # Bezpieczna obsługa rzeźby terenu / hydro
    if isinstance(terrain_data, Exception) or not terrain_data:
        limitations.append("Ostrzeżenie: Dane rzeźby terenu niedostępne. Przyjęto płaski teren bez rowów w pobliżu.")
        terrain_data = {
            "slope_percent": 1.0, "distance_to_ditch_m": 1000.0
        }

    # 3. Obliczenia agrohydrologiczne
    kbw_30d = calculate_kbw(
        precipitation_mm=weather_data["precipitation_30d_mm"],
        et0_mm=weather_data["et0_30d_mm"],
        kc=kc
    )
    kbw_60d = calculate_kbw(
        precipitation_mm=weather_data["precipitation_60d_mm"],
        et0_mm=weather_data["et0_60d_mm"],
        kc=kc
    )

    # Ocena ryzyka suszy
    drought_risk, kbw_status = evaluate_drought_risk(
        kbw_30d=kbw_30d,
        kbw_60d=kbw_60d,
        soil_category=soil_data["soil_category"]
    )

    # 4. Deterministyczny silnik decyzyjny (Decision Engine)
    rules_eval = evaluate_rules(
        kbw_30d=kbw_30d,
        kbw_60d=kbw_60d,
        awc_mm=soil_data["awc_mm"],
        soil_category=soil_data["soil_category"],
        slope_percent=terrain_data["slope_percent"],
        distance_to_ditch_m=terrain_data["distance_to_ditch_m"],
        ndvi_anomaly_percent=sentinel_data["ndvi_anomaly_percent"],
        crop_name=request.crop,
        area_ha=parcel.area_ha
    )

    # 5. Generowanie ustrukturyzowanych kart zaleceń (Report Generator)
    retention_actions = generate_retention_actions(rules_eval["active_rules"])
    irrigation_rec = generate_irrigation_recommendation(
        irrigation_needed=rules_eval["irrigation_needed"],
        deficit_mm=rules_eval["deficit_mm"],
        awc_mm=soil_data["awc_mm"],
        soil_category=soil_data["soil_category"],
        crop_name=request.crop
    )

    # Diagnoza (Etap 1)
    step1_diag = Diagnosis(
        kbw_30d_mm=kbw_30d,
        kbw_60d_mm=kbw_60d,
        kbw_status=kbw_status,
        drought_risk_level=drought_risk,
        awc_mm=soil_data["awc_mm"],
        soil_category=soil_data["soil_category"],
        soil_texture=soil_data["texture_name"],
        ndvi_current=sentinel_data["ndvi_current"],
        ndvi_historical_median=sentinel_data["ndvi_historical_median"],
        ndvi_anomaly_percent=sentinel_data["ndvi_anomaly_percent"],
        ndmi_current=sentinel_data["ndmi_current"],
        slope_percent=terrain_data["slope_percent"],
        distance_to_ditch_m=terrain_data["distance_to_ditch_m"],
        primary_causes=rules_eval["primary_causes"]
    )

    sources = [
        "Granice działki: ULDK GUGiK (Główny Urząd Geodezji i Kartografii)",
        "Meteorologia: Open-Meteo Archive / Forecast API (metodyka FAO-56 Penman-Monteith)",
        "Teledetekcja: Sentinel-2 L2A (AWS Earth Search STAC COG)",
        "Gleba i uziarnienie: ISRIC SoilGrids v2.0 REST API + równania Saxtona & Rawlsa (2006)",
        "Rzeźba i cieki: Geoportal NMT WCS + Overpass API / BDOT10k"
    ]

    exec_time_ms = int((time.time() - start_time) * 1000)

    metadata = ReportMetadata(
        sources=sources,
        analysis_date=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        sentinel_scene_date=sentinel_data.get("scene_date"),
        cloud_cover_percent=sentinel_data.get("cloud_cover_percent"),
        limitations=limitations,
        execution_time_ms=exec_time_ms
    )

    return AnalysisResponse(
        teryt=request.teryt,
        crop=request.crop,
        kc_coefficient=kc,
        parcel_info=parcel,
        step1_diagnosis=step1_diag,
        step2_retention=retention_actions,
        step3_irrigation=irrigation_rec,
        metadata=metadata
    )