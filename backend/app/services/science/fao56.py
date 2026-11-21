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

def evaluate_drought_risk(
    kbw_30d: float,
    kbw_60d: float,
    soil_category: str,
    awc_mm: float = 40.0
) -> Tuple[str, str]:
    """
    Ocenia stopień zagrożenia suszą rolniczą ORAZ nadmiernym uwilgotnieniem gleby (przelaniem / podtopieniem).
    """
    thresholds = {
        "bardzo lekka": -130.0,
        "lekka": -160.0,
        "średnia": -190.0,
        "ciężka": -220.0
    }
    crit_threshold = thresholds.get(soil_category.lower(), -170.0)
    waterlogging_threshold_30d = max(35.0, awc_mm * 0.85)
    waterlogging_threshold_60d = max(60.0, awc_mm * 1.4)

    if kbw_60d < crit_threshold or kbw_30d < (crit_threshold * 0.65):
        risk = "WYSOKIE"
        status = "Głęboki deficyt wodny (stwierdzona susza rolnicza IUNG)"
    elif kbw_60d < (crit_threshold * 0.6) or kbw_30d < (crit_threshold * 0.35):
        risk = "UMIARKOWANE"
        status = "Umiarkowany deficyt wilgotności (zagrożenie stresem wodnym)"
    elif kbw_60d < 0:
        risk = "NISKIE"
        status = "Lekki deficyt bilansowy, rośliny w normie"
    elif kbw_30d > waterlogging_threshold_30d or kbw_60d > waterlogging_threshold_60d:
        risk = "NADMIAR WODY"
        status = "Nadmierne uwilgotnienie gleby (ryzyko zastoisk wodnych i niedotlenienia korzeni)"
    else:
        risk = "BRAK"
        status = "Dodatni bilans wodny (optymalne uwilgotnienie)"

    return risk, status

