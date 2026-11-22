import time
import asyncio
from datetime import datetime, date, timedelta
from fastapi import APIRouter, HTTPException, status

from app.models.schemas import (
    AnalyzeRequest,
    AnalysisResponse,
    DailyWeatherPoint,
    DecadeForecastPoint,
    Diagnosis,
    ReportMetadata,
    ClimateVulnerability10Y
)
from app.services.gis.uldk import fetch_parcel_from_uldk
from app.services.gis.weather import (
    fetch_weather_data,
    calculate_10y_vulnerability,
    fetch_10y_climatology,
    analyze_climatology_metrics,
    MONTHLY_CLIMATE_NORMALS_PL,
)
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
            target_date_converted = date.fromisoformat(request.target_date)
            month = target_date_converted.month
        except ValueError:
            target_date_converted = date.today()
            month = target_date_converted.month
    else:
        target_date_converted = date.today()
        month = target_date_converted.month

    kc = get_crop_kc(request.crop, month=month)

    # 2. Równoległe pobranie pozostałych 4 źródeł danych z return_exceptions=True (Graceful Degradation)
    weather_task = fetch_weather_data(lat, lon, target_date_str=target_date_converted.isoformat())
    sentinel_task = fetch_sentinel_indices(lat, lon, target_date_converted.isoformat(), crop_name=request.crop)
    soil_task = fetch_soil_properties(lat, lon)
    terrain_task = fetch_terrain_and_hydro(lat, lon, ditch_distance_m=request.ditch_distance_m)

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
    if isinstance(weather_data, Exception) or not weather_data or not weather_data.get("raw_daily_series"):
        if isinstance(weather_data, Exception) or not weather_data:
            limitations.append("Meteorologia (Open-Meteo): Usługa chwilowo niedostępna – użyto referencyjnego modelu agrometeorologicznego.")
        
        fallback_series = []
        for d_offset in range(-60, 61):
            cur_d = target_date_converted + timedelta(days=d_offset)
            m_num = cur_d.month
            norm_val = MONTHLY_CLIMATE_NORMALS_PL.get(m_num, {"et0_daily": 2.5, "precip_monthly": 45.0, "temp": 15.0})
            fallback_series.append({
                "date": cur_d.isoformat(),
                "precipitation_mm": round(norm_val["precip_monthly"] / 20.0, 1) if (d_offset % 4 == 0) else 0.0,
                "et0_mm": norm_val["et0_daily"],
                "temp_max_c": norm_val["temp"],
                "wind_max_ms": 3.0,
                "is_forecast": d_offset > 0,
            })
            
        p_30 = sum(d["precipitation_mm"] for d in fallback_series[30:60])
        p_60 = sum(d["precipitation_mm"] for d in fallback_series[:60])
        e_30 = sum(d["et0_mm"] for d in fallback_series[30:60])
        e_60 = sum(d["et0_mm"] for d in fallback_series[:60])

        weather_data = {
            "precipitation_30d_mm": round(p_30, 1),
            "precipitation_60d_mm": round(p_60, 1),
            "et0_30d_mm": round(e_30, 1),
            "et0_60d_mm": round(e_60, 1),
            "forecast_7d_precip_mm": round(sum(d["precipitation_mm"] for d in fallback_series[61:68]), 1),
            "forecast_7d_et0_mm": round(sum(d["et0_mm"] for d in fallback_series[61:68]), 1),
            "forecast_60d_precip_mm": round(sum(d["precipitation_mm"] for d in fallback_series[61:]), 1),
            "forecast_60d_et0_mm": round(sum(d["et0_mm"] for d in fallback_series[61:]), 1),
            "mean_temperature_c": 19.0,
            "raw_daily_series": fallback_series,
            "is_fallback": True
        }
    elif weather_data.get("is_fallback"):
        limitations.append("Meteorologia: Wykorzystano zastępczy model agroklimatyczny z powodu niedostępności dostawcy.")

    # Bezpieczna obsługa satelity (Zero pozornej precyzji: brak sceny -> None)
    if isinstance(sentinel_data, Exception) or not sentinel_data:
        limitations.append("Teledetekcja Sentinel-2: Usługa STAC/CDSE niedostępna – brak możliwości wyliczenia NDVI/NDMI.")
        sentinel_data = {
            "ndvi_current": None, "ndvi_historical_median": None, "ndvi_anomaly_percent": None,
            "ndmi_current": None, "scene_date": None, "cloud_cover_percent": None,
            "is_fallback": True,
            "limitation_note": "Brak danych satelitarnych Sentinel-2."
        }
    elif sentinel_data.get("limitation_note"):
        limitations.append(sentinel_data["limitation_note"])

    # Bezpieczna obsługa gleby (Spójna skala AWC dla warstwy 0-30 cm: 30.9 mm)
    if isinstance(soil_data, Exception) or not soil_data or soil_data.get("is_fallback"):
        limitations.append("Gleba (ISRIC SoilGrids): Baza niedostępna – zastosowano profil referencyjny gleby lekkiej (piasek gliniasty, AWC: 30.9 mm dla 30 cm).")
        if isinstance(soil_data, Exception) or not soil_data:
            soil_data = {
                "soil_category": "lekka", "awc_mm": 30.9, "texture_name": "piasek gliniasty (profil referencyjny)",
                "is_fallback": True
            }

    # Bezpieczna obsługa rzeźby terenu / hydro
    if isinstance(terrain_data, Exception) or not terrain_data:
        limitations.append("Rzeźba terenu i hydrografia: Usługi DEM / Overpass API były chwilowo niedostępne.")
        terrain_data = {
            "slope_percent": None,
            "aspect_direction": None,
            "dem_source": None,
            "dem_available": False,
            "dem_limitation": None,
            "is_slope_fallback": True,
            "distance_to_ditch_m": None,
            "hydro_data_available": False,
            "hydro_limitation": None,
            "nearest_waterway_coords": None,
            "nearest_waterway_point": None,
            "nearest_waterway_type": None,
            "has_wetland_or_pond_nearby": None,
            "has_windbreak_nearby": None,
            "nearest_river": None,
            "river_distance_m": None,
            "water_level_cm": None,
        }
    else:
        if terrain_data.get("dem_available") is False and terrain_data.get("dem_limitation"):
            limitations.append(terrain_data["dem_limitation"])
        if terrain_data.get("hydro_data_available") is False and terrain_data.get("hydro_limitation"):
            limitations.append(terrain_data["hydro_limitation"])

    # Flaga fallbacku z ULDK GUGiK
    if getattr(parcel, "is_fallback", False):
        limitations.append("ULDK GUGiK: Brak geometrii działki z państwowego rejestru katastralnego – przyjęto przybliżoną lokalizację z bazy TERYT.")

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

    # Ocena ryzyka suszy oraz nadmiernego uwilgotnienia
    drought_risk, kbw_status = evaluate_drought_risk(
        kbw_30d=kbw_30d,
        kbw_60d=kbw_60d,
        soil_category=soil_data["soil_category"],
        awc_mm=soil_data["awc_mm"]
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
        area_ha=parcel.area_ha,
        has_wetland_or_pond_nearby=terrain_data.get("has_wetland_or_pond_nearby"),
        has_windbreak_nearby=terrain_data.get("has_windbreak_nearby"),
    )

    # 5. Generowanie ustrukturyzowanych kart zaleceń (Report Generator)
    retention_actions = generate_retention_actions(rules_eval["active_rules"])
    
    fc_7d_p = weather_data.get("forecast_7d_precip_mm") or 0.0
    wind_max_7d = max(
        [pt.get("wind_max_ms") or 0.0 for pt in weather_data.get("raw_daily_series", [])[-16:]] or [0.0]
    )

    irrigation_rec = generate_irrigation_recommendation(
        irrigation_needed=rules_eval["irrigation_needed"],
        deficit_mm=rules_eval["deficit_mm"],
        awc_mm=soil_data["awc_mm"],
        soil_category=soil_data["soil_category"],
        crop_name=request.crop,
        forecast_7d_precip_mm=fc_7d_p,
        wind_max_ms=wind_max_7d
    )

    # Diagnoza (Etap 1) + Szereg 60 dni historii i 60 dni prognozy długoterminowej (6 dekad)
    soil_thresholds = {
        "bardzo lekka": -130.0,
        "lekka": -160.0,
        "średnia": -190.0,
        "ciężka": -220.0,
    }
    crit_threshold_60d = soil_thresholds.get(soil_data["soil_category"].lower(), -170.0)

    def _growth_stage_for_month(m: int) -> str:
        if m <= 3:
            return "Spoczynek / ruszenie wegetacji"
        if m == 4:
            return "Wschody i faza początkowa"
        if m in (5, 6):
            return "Intensywny wzrost wegetatywny"
        if m in (7, 8):
            return "Faza krytyczna (kwitnienie i budowa plonu)"
        if m in (9, 10):
            return "Dojrzewanie i zbiory"
        return "Okres jesienno-zimowy (retencja pozimowa)"

    daily_series = []
    daily_kbw_values = []
    raw_series = weather_data.get("raw_daily_series", [])

    for idx, pt in enumerate(raw_series):
        p_val = pt["precipitation_mm"]
        et0_val = pt["et0_mm"]
        try:
            pt_month = int(pt["date"].split("-")[1])
        except Exception:
            pt_month = month
        day_kc = get_crop_kc(request.crop, month=pt_month) if pt["is_forecast"] else kc
        kbw_d = round(p_val - (et0_val * day_kc), 1)
        daily_kbw_values.append(kbw_d)

        # Kroczący bilans 60-dniowy (okno ruchome do 60 dni wstecz, zgodnie z metodyką IUNG-PIB)
        window_start = max(0, idx - 59)
        rolling_60d = round(sum(daily_kbw_values[window_start : idx + 1]), 1)

        daily_series.append(DailyWeatherPoint(
            date=pt["date"],
            precipitation_mm=p_val,
            et0_mm=et0_val,
            kbw_daily_mm=kbw_d,
            kbw_cumulative_mm=rolling_60d,
            is_forecast=pt["is_forecast"],
            temp_max_c=pt.get("temp_max_c"),
            wind_max_ms=pt.get("wind_max_ms"),
        ))

    # Budowa 6 dekad (po 10 dni = 60 dni prognozy długoterminowej)
    forecast_points = [d for d in daily_series if d.is_forecast]
    roman_numerals = ["I", "II", "III", "IV", "V", "VI"]
    decades_list = []
    rolling_kbw_60d = kbw_60d

    for dec_idx in range(6):
        chunk = forecast_points[dec_idx * 10 : (dec_idx + 1) * 10]
        if not chunk:
            break
        start_d = chunk[0].date
        end_d = chunk[-1].date
        try:
            dec_month = int(start_d.split("-")[1])
        except Exception:
            dec_month = month
        dec_kc = get_crop_kc(request.crop, month=dec_month)
        dec_stage = _growth_stage_for_month(dec_month)
        dec_p = round(sum(c.precipitation_mm for c in chunk), 1)
        dec_et0 = round(sum(c.et0_mm for c in chunk), 1)
        dec_etc = round(dec_et0 * dec_kc, 1)
        dec_kbw = round(dec_p - dec_etc, 1)

        # Kroczący bilans 60-dniowy przesuwa się o kolejną dekadę
        rolling_kbw_60d = round(rolling_kbw_60d * (50.0 / 60.0) + dec_kbw, 1)

        if rolling_kbw_60d < crit_threshold_60d:
            risk_msg = f"Wysokie ryzyko suszy (przekroczony próg IUNG {crit_threshold_60d:.0f} mm) — wymagana rezerwa nawodnieniowa"
        elif dec_kbw < -18.0:
            risk_msg = "Rosnący deficyt w dekadzie — priorytet zatrzymania wody w glebie i rowach"
        else:
            risk_msg = "Bilans dekadowy stabilny — naturalna retencja glebowa wystarczająca"

        day_from = dec_idx * 10 + 1
        day_to = dec_idx * 10 + len(chunk)
        if dec_idx >= 2:
            period_label_txt = f"{roman_numerals[dec_idx]} dekada (+{day_from}..+{day_to} dni) – Scenariusz agroklimatyczny"
        else:
            period_label_txt = f"{roman_numerals[dec_idx]} dekada (+{day_from}..+{day_to} dni) – Prognoza synoptyczna"

        decades_list.append(DecadeForecastPoint(
            decade_number=dec_idx + 1,
            period_label=period_label_txt,
            start_date=start_d,
            end_date=end_d,
            crop_kc=round(dec_kc, 2),
            growth_stage=dec_stage,
            precipitation_mm=dec_p,
            et0_mm=dec_et0,
            etc_mm=dec_etc,
            kbw_decade_mm=dec_kbw,
            kbw_60d_rolling_mm=rolling_kbw_60d,
            risk_status=risk_msg,
        ))

    forecast_60d_kbw_total = round(sum(d.kbw_decade_mm for d in decades_list), 1) if decades_list else None

    # Obliczenie 10-letniej podatności historycznej działki na suszę rolniczą
    vulnerability_10y = calculate_10y_vulnerability(lat, lon, parcel.voivodeship)

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
        aspect_direction=terrain_data.get("aspect_direction"),
        distance_to_ditch_m=terrain_data["distance_to_ditch_m"],
        nearest_river=terrain_data.get("nearest_river"),
        river_distance_m=terrain_data.get("river_distance_m"),
        water_level_cm=terrain_data.get("water_level_cm"),
        nearest_waterway_coords=terrain_data.get("nearest_waterway_coords"),
        nearest_waterway_point=terrain_data.get("nearest_waterway_point"),
        nearest_waterway_type=terrain_data.get("nearest_waterway_type"),
        has_wetland_or_pond_nearby=terrain_data.get("has_wetland_or_pond_nearby"),
        has_windbreak_nearby=terrain_data.get("has_windbreak_nearby"),
        primary_causes=rules_eval["primary_causes"],
        precipitation_30d_mm=weather_data.get("precipitation_30d_mm"),
        et0_30d_mm=weather_data.get("et0_30d_mm"),
        forecast_7d_precip_mm=weather_data.get("forecast_7d_precip_mm"),
        forecast_7d_et0_mm=weather_data.get("forecast_7d_et0_mm"),
        forecast_60d_precip_mm=weather_data.get("forecast_60d_precip_mm"),
        forecast_60d_et0_mm=weather_data.get("forecast_60d_et0_mm"),
        forecast_60d_kbw_mm=forecast_60d_kbw_total,
        critical_threshold_kbw_60d_mm=crit_threshold_60d,
        daily_weather_series=daily_series or None,
        forecast_60d_decades=decades_list or None,
        historical_vulnerability=ClimateVulnerability10Y(**vulnerability_10y),
    )

    dem_source_label = terrain_data.get("dem_source") or "DEM (niedostępny)"
    sources = [
        "Granice działki: ULDK GUGiK (Główny Urząd Geodezji i Kartografii)",
        "Meteorologia: Open-Meteo Archive / Forecast API (metodyka FAO-56 Penman-Monteith)",
        "Teledetekcja: Copernicus Data Space Ecosystem (CDSE) / Sentinel-2 L2A Process API",
        "Gleba i uziarnienie: ISRIC SoilGrids v2.0 REST API + równania Saxtona & Rawlsa (2006)",
        f"Hydrografia i rzeźba: OpenStreetMap Overpass API + {dem_source_label} + IMGW-PIB Hydro"
    ]

    exec_time_ms = int((time.time() - start_time) * 1000)

    # Obliczenie wskaźnika wiarygodności danych (Confidence Index)
    conf_score = 100
    if weather_data.get("is_fallback"):
        conf_score -= 15
    if sentinel_data.get("ndvi_current") is None:
        conf_score -= 20
    if soil_data.get("is_fallback"):
        conf_score -= 20
    if terrain_data.get("is_slope_fallback"):
        conf_score -= 10
    if getattr(parcel, "is_fallback", False):
        conf_score -= 15

    conf_level = "Wysoka" if conf_score >= 80 else ("Średnia" if conf_score >= 55 else "Obniżona")

    target_date_label = request.target_date or datetime.now().strftime("%Y-%m-%d")

    data_freshness = {
        "Granice działki (ULDK GUGiK)": "Kataster bieżący (stan na żywo)" if not getattr(parcel, "is_fallback", False) else "Przybliżona lokalizacja TERYT",
        "Meteorologia (Open-Meteo)": f"Zakres 60 dni wstecz do {target_date_label}",
        "Teledetekcja (Sentinel-2)": f"Scena z dnia {sentinel_data.get('scene_date')}" if sentinel_data.get("scene_date") else "Brak bezchmurnej sceny (<15% chmur)",
        "Gleba (ISRIC SoilGrids)": "Model statyczny 250 m (ISRIC v2.0)" if not soil_data.get("is_fallback") else "Profil referencyjny IUNG",
        "Wysokość i cieki (NMT / OSM)": "Numeryczny Model Terenu GUGiK / OpenStreetMap"
    }

    metadata = ReportMetadata(
        sources=sources,
        analysis_date=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        target_date=target_date_label,
        sentinel_scene_date=sentinel_data.get("scene_date"),
        cloud_cover_percent=sentinel_data.get("cloud_cover_percent"),
        limitations=limitations,
        execution_time_ms=exec_time_ms,
        data_freshness=data_freshness,
        confidence_level=conf_level,
        confidence_score=conf_score
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