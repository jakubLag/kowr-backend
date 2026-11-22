"""
Deterministyczny silnik reguł agrohydrologicznych.
100% deterministyczny, audytowalny, bez udziału LLM.
Identyfikuje warunki na działce i aktywuje dedykowane reguły retencyjne oraz diagnozę.
"""

from typing import List, Dict, Any, Optional

def evaluate_rules(
    kbw_30d: float,
    kbw_60d: float,
    awc_mm: float,
    soil_category: str,
    slope_percent: Optional[float],
    distance_to_ditch_m: Optional[float],
    ndvi_anomaly_percent: Optional[float],
    crop_name: str,
    area_ha: float,
    has_wetland_or_pond_nearby: Optional[bool] = None,
    has_windbreak_nearby: Optional[bool] = None,
) -> Dict[str, Any]:
    """
    Analizuje parametry biofizyczne i przestrzenne działki.
    Zwraca:
    - primary_causes: lista zidentyfikowanych przyczyn ubytków wody
    - active_rules: lista wyzwalanych reguł do wygenerowania kart retencji
    - irrigation_needed: bool
    - deficit_mm: float
    """
    primary_causes = []
    active_rules = []

    is_waterlogged = kbw_30d > max(35.0, awc_mm * 0.85) or kbw_60d > max(60.0, awc_mm * 1.4)

    # 1. Analiza przyczyn deficytu lub nadmiaru wody
    if is_waterlogged:
        primary_causes.append(
            f"Nadwyżka opadów nad parowaniem (KBW 30d: +{kbw_30d:.1f} mm, KBW 60d: +{kbw_60d:.1f} mm) "
            f"przekracza pojemność wodną warstwy ornej (AWC: {awc_mm:.1f} mm) — ryzyko zastoisk wodnych i niedotlenienia korzeni."
        )
    elif kbw_60d < -100:
        primary_causes.append(f"Głęboki ujemny bilans opadów do parowania (KBW 60d: {kbw_60d:.1f} mm).")
    elif kbw_30d < -50:
        primary_causes.append(f"Krótkoterminowy deficyt opadów w kluczowej fazie wegetacji (KBW 30d: {kbw_30d:.1f} mm).")

    if not is_waterlogged:
        if awc_mm < 35:
            primary_causes.append(f"Bardzo niska retencja glebowa (AWC: {awc_mm:.1f} mm, kategoria {soil_category}) – woda opadowa natychmiast ucieka do głębszych warstw.")
        elif awc_mm < 50:
            primary_causes.append(f"Ograniczona pojemność wodna gleby lekkiej (AWC: {awc_mm:.1f} mm) sprzyja szybkiemu przesychaniu wierzchniej warstwy.")

    if slope_percent is not None:
        if slope_percent >= 3.0:
            primary_causes.append(f"Spadek terenu {slope_percent:.1f}% powoduje intensywny spływ powierzchniowy wody przed jej wsiąknięciem w profil glebowy.")
        else:
            primary_causes.append(f"Nachylenie terenu ({slope_percent:.1f}%) jest na tyle małe, że rowy nie wpływają na nawodnienie.")

    if distance_to_ditch_m is not None and distance_to_ditch_m <= 150:
        if is_waterlogged:
            primary_causes.append(f"Obecność rowu melioracyjnego w odległości {distance_to_ditch_m:.0f} m wymaga utrzymania drożności odpływu w celu odprowadzenia wody zastoiskowej.")
        else:
            primary_causes.append(f"Bliskość otwartego rowu melioracyjnego ({distance_to_ditch_m:.0f} m) przyspiesza drenaż wód gruntowych z działki.")

    if ndvi_anomaly_percent is not None and ndvi_anomaly_percent < -10.0:
        primary_causes.append(f"Kondycja biomasy (NDVI) jest o {abs(ndvi_anomaly_percent):.1f}% niższa od mediany wieloletniej, potwierdzając stres roślin.")

    if not primary_causes:
        primary_causes.append("Warunki wodne i wilgotnościowe w granicach normy wieloletniej.")

    # 2. Dobór reguł retencyjnych i melioracyjnych
    if is_waterlogged:
        if distance_to_ditch_m is not None and distance_to_ditch_m <= 300:
            active_rules.append({
                "rule_id": "DRAINAGE_DITCH_OPEN_WEIR",
                "priority": 1,
                "category": "landscape",
                "params": {
                    "kbw_30d": kbw_30d,
                    "dist_m": round(distance_to_ditch_m),
                    "crop": crop_name
                }
            })
        active_rules.append({
            "rule_id": "SOIL_WATERLOGGING_SUBSOILING",
            "priority": 1,
            "category": "soil",
            "params": {
                "kbw_30d": kbw_30d,
                "awc": awc_mm,
                "crop": crop_name
            }
        })
    else:
        # Reguła A: Zastawka na rowie melioracyjnym (Priorytet 1 - retencja krajobrazowa)
        if distance_to_ditch_m is not None and distance_to_ditch_m <= 300:
            active_rules.append({
                "rule_id": "RETENTION_DITCH_WEIR",
                "priority": 1,
                "category": "landscape",
                "params": {
                    "slope": slope_percent,
                    "dist_m": round(distance_to_ditch_m),
                    "crop": crop_name
                }
            })

    # Reguła B: Międzyplony i mulczowanie (Retencja glebowa - niska AWC)
    if awc_mm < 55 or soil_category in ["bardzo lekka", "lekka"]:
        active_rules.append({
            "rule_id": "SOIL_LOW_AWC_COVER_CROP",
            "priority": 2,
            "category": "soil",
            "params": {
                "awc": awc_mm,
                "crop": crop_name,
                "soil_category": soil_category
            }
        })

    # Reguła C: Uprawa bezorkowa / konserwująca (Ograniczenie parowania)
    if kbw_30d < -40 or awc_mm < 60:
        active_rules.append({
            "rule_id": "NO_TILL_EVAPORATION_REDUCTION",
            "priority": 2,
            "category": "soil",
            "params": {
                "kbw_30d": kbw_30d,
                "crop": crop_name
            }
        })

    # Reguła D: Uprawa w poprzek stoku / pasy antyerozyjne (Spadek >= 3%)
    if slope_percent is not None and slope_percent >= 3.0:
        active_rules.append({
            "rule_id": "CONTOUR_FARMING_SLOPE",
            "priority": 2,
            "category": "landscape",
            "params": {
                "slope": slope_percent,
                "crop": crop_name
            }
        })

    # Reguła E: Ochrona i strefa buforowa przy oczkach wodnych / mokradłach (bufor 500 m)
    if has_wetland_or_pond_nearby is True:
        active_rules.append({
            "rule_id": "WETLAND_POND_PROTECTION",
            "priority": 2,
            "category": "landscape",
            "params": {
                "crop": crop_name
            }
        })

    # Reguła F: Zadrzewienia śródpolne i pasy wiatrochronne (brak zadrzewień w 300 m przy deficycie)
    if has_windbreak_nearby is False and not is_waterlogged and (kbw_30d < -30 or kbw_60d < -60):
        active_rules.append({
            "rule_id": "WINDBREAK_SHELTERBELT",
            "priority": 3,
            "category": "landscape",
            "params": {
                "kbw_30d": kbw_30d,
                "crop": crop_name
            }
        })

    # Reguła G: Mikro-zbiornik retencyjny / niecka chłonna (Działki > 1 ha przy deficycie)
    if area_ha >= 1.0 and (kbw_60d < -80 or (distance_to_ditch_m is not None and distance_to_ditch_m > 300)):
        active_rules.append({
            "rule_id": "MICRO_RETENTION_POND",
            "priority": 3,
            "category": "micro_storage",
            "params": {
                "area_ha": area_ha,
                "kbw_60d": kbw_60d
            }
        })

    # Sortowanie reguł wg priorytetu
    active_rules.sort(key=lambda r: r["priority"])

    # 3. Ocena potrzeby nawadniania interwencyjnego
    # Obliczamy deficyt wilgotności w profilu
    deficit_mm = 0.0
    irrigation_needed = False
    if kbw_30d < -50:
        # Brakuje wody w stosunku do optymalnego bilansu
        deficit_mm = abs(kbw_30d) * 0.5
        # Dawka nie powinna przekraczać pojemności gleby AWC
        max_single_dose = min(35.0, max(15.0, awc_mm * 0.7))
        deficit_mm = round(min(deficit_mm, max_single_dose), 1)
        irrigation_needed = True

    return {
        "primary_causes": primary_causes,
        "active_rules": active_rules,
        "irrigation_needed": irrigation_needed,
        "deficit_mm": deficit_mm
    }

