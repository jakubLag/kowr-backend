import pytest
from app.services.science.fao56 import calculate_kbw, evaluate_drought_risk
from app.services.science.saxton_rawls import calculate_saxton_rawls_awc
from app.services.science.crops import (
    get_crop_kc,
    get_crop_ndvi_reference,
    get_crop_growth_stage,
    CROP_DATABASE,
)
from app.services.science.decision_engine import evaluate_rules
from app.services.science.report_generator import (
    generate_retention_actions,
    generate_irrigation_recommendation
)

def test_kbw_calculation():
    # P = 40 mm, ET0 = 120 mm, Kc = 1.2
    # ETC = 120 * 1.2 = 144 mm
    # KBW = 40 - 144 = -104.0 mm
    kbw = calculate_kbw(precipitation_mm=40.0, et0_mm=120.0, kc=1.2)
    assert kbw == -104.0

def test_drought_risk_classification():
    risk, status = evaluate_drought_risk(kbw_30d=-80.0, kbw_60d=-180.0, soil_category="bardzo lekka")
    assert risk == "WYSOKIE"
    assert "Głęboki deficyt" in status

def test_saxton_rawls_light_soil():
    # Piasek gliniasty: dużo piasku, mało iłu
    props = calculate_saxton_rawls_awc(sand_percent=75.0, clay_percent=8.0, soc_percent=1.2)
    assert props["soil_category"] in ["bardzo lekka", "lekka"]
    assert props["awc_mm"] > 0
    assert props["theta_fc"] > props["theta_wp"]

def test_crop_database_and_kc():
    assert "kukurydza" in CROP_DATABASE
    assert get_crop_kc("kukurydza", month=7) == 1.20
    assert get_crop_kc("kukurydza", month=4) == 0.30

    # Wszystkie 10 upraw ma pełne 12-miesięczne mapy Kc i NDVI
    for crop_id, crop_data in CROP_DATABASE.items():
        assert set(crop_data["kc_by_month"].keys()) == set(range(1, 13)), crop_id
        assert set(crop_data["ndvi_by_month"].keys()) == set(range(1, 13)), crop_id


def test_winter_vs_spring_phenology():
    # Pszenica ozima: szczyt w maju-czerwcu, ściernisko w sierpniu
    assert get_crop_kc("pszenica_ozima", month=4) == 0.85
    assert get_crop_kc("pszenica_ozima", month=5) == 1.15
    assert get_crop_kc("pszenica_ozima", month=8) == 0.25
    assert get_crop_ndvi_reference("pszenica_ozima", month=5) >= 0.75
    assert get_crop_ndvi_reference("pszenica_ozima", month=8) <= 0.30
    assert "ściernisko" in get_crop_growth_stage("pszenica_ozima", month=8).lower()

    # Rzepak ozimy: szczyt IV-V, spadek VI-VII, ściernisko VIII
    assert get_crop_kc("rzepak", month=5) == 1.10
    assert get_crop_kc("rzepak", month=6) == 0.70
    assert get_crop_kc("rzepak", month=8) == 0.25

    # Kukurydza (jara): niska w IV-V, szczyt VII-VIII
    assert get_crop_kc("kukurydza", month=5) == 0.45
    assert get_crop_kc("kukurydza", month=8) == 1.20
    assert "kwitnienie" in get_crop_growth_stage("kukurydza", month=8).lower()

def test_decision_engine_rules():
    result = evaluate_rules(
        kbw_30d=-65.0,
        kbw_60d=-140.0,
        awc_mm=32.0,
        soil_category="bardzo lekka",
        slope_percent=4.5,
        distance_to_ditch_m=80.0,
        ndvi_anomaly_percent=-15.0,
        crop_name="kukurydza",
        area_ha=2.5
    )
    rule_ids = [r["rule_id"] for r in result["active_rules"]]
    # Dystans do rowu < 300m -> zastawka
    assert "RETENTION_DITCH_WEIR" in rule_ids
    # AWC < 55 -> międzyplony
    assert "SOIL_LOW_AWC_COVER_CROP" in rule_ids
    # Spadek >= 3.0 -> uprawa w poprzek stoku
    assert "CONTOUR_FARMING_SLOPE" in rule_ids
    # Nawadnianie interwencyjne potrzebne
    assert result["irrigation_needed"] is True

def test_report_generation():
    active_rules = [{
        "rule_id": "RETENTION_DITCH_WEIR",
        "priority": 1,
        "category": "landscape",
        "params": {"slope": 4.5, "dist_m": 80, "crop": "kukurydza"}
    }]
    actions = generate_retention_actions(active_rules)
    assert len(actions) == 1
    assert "zastawk" in actions[0].title.lower()
    assert "80 m" in actions[0].why

    rec = generate_irrigation_recommendation(
        irrigation_needed=True,
        deficit_mm=25.0,
        awc_mm=32.0,
        soil_category="bardzo lekka",
        crop_name="kukurydza"
    )
    assert rec.needed is True
    assert rec.dose_mm == 25.0
    assert rec.dose_m3_per_ha == 250.0

def test_decision_engine_low_slope_ditch():
    result = evaluate_rules(
        kbw_30d=-10.0,
        kbw_60d=-20.0,
        awc_mm=60.0,
        soil_category="średnia",
        slope_percent=1.2,
        distance_to_ditch_m=40.0,
        ndvi_anomaly_percent=0.0,
        crop_name="pszenica_ozima",
        area_ha=3.0
    )
    causes_text = " ".join(result["primary_causes"]).lower()
    # Płaski teren nie jest przyczyną niedoboru wody
    assert "płaskie ukształtowanie" not in causes_text
    assert "rowy nie wpływają" not in causes_text

    rule_ids = [r["rule_id"] for r in result["active_rules"]]
    assert "RETENTION_DITCH_WEIR" in rule_ids
    assert "WATERWAY_BUFFER_STRIP" in rule_ids

    actions = generate_retention_actions(result["active_rules"])
    weir_action = next(a for a in actions if a.id == "RETENTION_DITCH_WEIR")
    assert "rowy nie wpływają" not in weir_action.why.lower()


def test_crop_drought_sensitivity_affects_irrigation():
    # Ziemniak (BARDZO WYSOKA wrażliwość, korzeń 0.6m) vs Żyto (NISKA wrażliwość, korzeń 1.1m)
    potato = evaluate_rules(
        kbw_30d=-45.0, kbw_60d=-80.0, awc_mm=45.0, soil_category="lekka",
        slope_percent=1.0, distance_to_ditch_m=None, ndvi_anomaly_percent=None,
        crop_name="ziemniak", area_ha=2.0
    )
    rye = evaluate_rules(
        kbw_30d=-45.0, kbw_60d=-80.0, awc_mm=45.0, soil_category="lekka",
        slope_percent=1.0, distance_to_ditch_m=None, ndvi_anomaly_percent=None,
        crop_name="zyto", area_ha=2.0
    )
    assert potato["irrigation_needed"] is True
    assert rye["irrigation_needed"] is False


def test_irrigation_weather_window_and_archive():
    # Deszcz >= deficit -> wstrzymanie (needed=False, dose=0)
    rec_rain = generate_irrigation_recommendation(
        irrigation_needed=True, deficit_mm=18.0, awc_mm=40.0,
        soil_category="lekka", crop_name="kukurydza",
        forecast_7d_precip_mm=22.0, wind_max_ms=2.0, is_archive=False
    )
    assert rec_rain.needed is False
    assert rec_rain.dose_mm == 0.0
    assert rec_rain.weather_window_status == "WSTRZYMAJ_OPADY"

    # Wiatr > 5.0 m/s -> ostrzeżenie
    rec_wind = generate_irrigation_recommendation(
        irrigation_needed=True, deficit_mm=25.0, awc_mm=40.0,
        soil_category="lekka", crop_name="kukurydza",
        forecast_7d_precip_mm=2.0, wind_max_ms=5.5, is_archive=False
    )
    assert rec_wind.needed is True
    assert rec_wind.weather_window_status == "OSTRZEZENIE_WIATR"

    # Data archiwalna -> nie wstrzymuje nawadniania przyszłym deszczem
    rec_arch = generate_irrigation_recommendation(
        irrigation_needed=True, deficit_mm=25.0, awc_mm=40.0,
        soil_category="lekka", crop_name="kukurydza",
        forecast_7d_precip_mm=40.0, wind_max_ms=9.0, is_archive=True
    )
    assert rec_arch.needed is True
    assert rec_arch.dose_mm == 25.0
    assert rec_arch.weather_window_status == "ARCHIWALNA"


