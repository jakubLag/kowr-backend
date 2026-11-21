import pytest
from app.services.science.fao56 import calculate_kbw, evaluate_drought_risk
from app.services.science.saxton_rawls import calculate_saxton_rawls_awc
from app.services.science.crops import get_crop_kc, CROP_DATABASE
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
    kc_mid = get_crop_kc("kukurydza", month=7)
    assert kc_mid == 1.20
    kc_init = get_crop_kc("kukurydza", month=4)
    assert kc_init == 0.35

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
        soil_category="srednia",
        slope_percent=1.2,
        distance_to_ditch_m=40.0,
        ndvi_anomaly_percent=0.0,
        crop_name="pszenica_ozima",
        area_ha=3.0
    )
    causes_text = " ".join(result["primary_causes"])
    assert "rowy nie wpływają na nawodnienie" in causes_text


