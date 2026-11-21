"""
Równania pedotransferowe Saxtona i Rawlsa (2006) do wyznaczania właściwości wodnych gleby.
Pozwala na obliczenie:
- Wilgotności przy polowej pojemności wodnej (FC - Field Capacity)
- Wilgotności przy punkcie trwałego więdnięcia (WP - Wilting Point)
- Dostępnej wody dla roślin (AWC - Available Water Capacity) w mm dla warstwy 0-30 cm
"""

import math
from typing import Dict, Any, Tuple

def calculate_saxton_rawls_awc(
    sand_percent: float,
    clay_percent: float,
    soc_percent: float,
    layer_thickness_cm: float = 30.0
) -> Dict[str, Any]:
    """
    Oblicza retencję wodną gleby równaniami Saxtona-Rawlsa (Soil Science Society of America Journal, 2006).
    sand_percent: zawartość frakcji piasku (0-100%)
    clay_percent: zawartość frakcji iłu (0-100%)
    soc_percent: węgiel organiczny w % (SOC), próchnica = SOC * 1.724
    layer_thickness_cm: grubość warstwy korzeniowej (standardowo 30 cm)
    """
    S = sand_percent / 100.0
    C = clay_percent / 100.0
    OM = (soc_percent * 1.724)  # materia organiczna (organic matter %)

    # Ograniczenia wartości
    S = max(0.01, min(0.95, S))
    C = max(0.01, min(0.90, C))
    OM = max(0.1, min(10.0, OM))

    # 1. Punkt trwałego więdnięcia wilgotność objętościowa (1500 kPa)
    theta_wp_first = (
        -0.024 * S
        + 0.487 * C
        + 0.006 * OM
        + 0.005 * (S * OM)
        - 0.013 * (C * OM)
        + 0.068 * (S * C)
        + 0.031
    )
    theta_wp = theta_wp_first + (0.14 * theta_wp_first - 0.02)

    # 2. Polowa pojemność wodna wilgotność objętościowa (33 kPa)
    theta_fc_first = (
        -0.251 * S
        + 0.195 * C
        + 0.011 * OM
        + 0.006 * (S * OM)
        - 0.027 * (C * OM)
        + 0.452 * (S * C)
        + 0.299
    )
    theta_fc = theta_fc_first + (1.283 * (theta_fc_first**2) - 0.374 * theta_fc_first - 0.015)

    # 3. Nasycenie wodne (porowatość)
    theta_sat = 0.332 - 7.251e-4 * (S * 100) + 0.1276 * math.log10(max(1.0, C * 100))

    # AWC (Available Water Capacity) = (FC - WP) * grubość warstwy w mm
    awc_fraction = max(0.02, theta_fc - theta_wp)
    awc_mm = awc_fraction * (layer_thickness_cm * 10.0)

    # Klasyfikacja kategorii agronomicznej gleby wg IUNG:
    # Kat. I: bardzo lekka (ił < 10%, piasek > 75%)
    # Kat. II: lekka (ił 10-20%, piasek 50-75%)
    # Kat. III: średnia (ił 20-35% lub pyły)
    # Kat. IV: ciężka (ił > 35%)
    if C < 0.10 and S > 0.70:
        soil_category = "bardzo lekka"
        texture_name = "piasek luźny / słabogliniasty"
    elif C <= 0.20 and S >= 0.50:
        soil_category = "lekka"
        texture_name = "piasek gliniasty"
    elif C <= 0.35:
        soil_category = "średnia"
        texture_name = "glina piaszczysta / pył"
    else:
        soil_category = "ciężka"
        texture_name = "glina ciężka / ił"

    return {
        "theta_wp": round(theta_wp, 3),
        "theta_fc": round(theta_fc, 3),
        "theta_sat": round(theta_sat, 3),
        "awc_fraction": round(awc_fraction, 3),
        "awc_mm": round(awc_mm, 1),
        "soil_category": soil_category,
        "texture_name": texture_name
    }

