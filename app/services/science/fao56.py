"""
Moduł obliczeń Klimatycznego Bilansu Wodnego (KBW) wg metodyki FAO-56 oraz IUNG-PIB.
KBW = P - (ET0 * Kc)
"""

from typing import Dict, Any, Tuple

def calculate_kbw(precipitation_mm: float, et0_mm: float, kc: float) -> float:
    """
    Oblicza Klimatyczny Bilans Wodny (KBW) w mm:
    KBW = P - (ET0 * Kc)
    Wartość ujemna oznacza deficyt wodny (susza).
    """
    etc = et0_mm * kc
    kbw = precipitation_mm - etc
    return round(kbw, 1)

def evaluate_drought_risk(kbw_30d: float, kbw_60d: float, soil_category: str) -> Tuple[str, str]:
    """
    Ocenia stopień zagrożenia suszą rolniczą wg kryteriów zbliżonych do Systemu Monitoringu Suszy Rolniczej (IUNG-PIB).
    Kategorie gleb IUNG:
    - Kategoria I (gleba bardzo lekka / piasek): próg KBW ok. -130 do -150 mm
    - Kategoria II (gleba lekka / piasek gliniasty): próg KBW ok. -160 do -180 mm
    - Kategoria III (gleba średnia / pyły, gliny lekkie): próg KBW ok. -190 do -210 mm
    - Kategoria IV (gleba ciężka / gliny, iły): próg KBW ok. -220 do -250 mm
    """
    # Progi dla 60-dniowego KBW
    thresholds = {
        "bardzo lekka": -130.0,
        "lekka": -160.0,
        "średnia": -190.0,
        "ciężka": -220.0
    }
    crit_threshold = thresholds.get(soil_category.lower(), -170.0)

    if kbw_60d < crit_threshold or kbw_30d < (crit_threshold * 0.65):
        risk = "WYSOKIE"
        status = "Głęboki deficyt wodny (stwierdzona susza rolnicza IUNG)"
    elif kbw_60d < (crit_threshold * 0.6) or kbw_30d < (crit_threshold * 0.35):
        risk = "UMIARKOWANE"
        status = "Umiarkowany deficyt wilgotności (zagrożenie stresem wodnym)"
    elif kbw_60d < 0:
        risk = "NISKIE"
        status = "Lekki deficyt bilansowy, rośliny w normie"
    else:
        risk = "BRAK"
        status = "Dodatni bilans wodny (optymalne uwilgotnienie)"

    return risk, status

