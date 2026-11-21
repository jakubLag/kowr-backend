"""
Słownik współczynników roślinnych Kc (FAO-56) dla głównych upraw w Polsce.
Wartości Kc dostosowane do metodyki IUNG-PIB i FAO Irrigation and Drainage Paper 56.
"""

from typing import Dict, Any

CROP_DATABASE: Dict[str, Dict[str, Any]] = {
    "kukurydza": {
        "id": "kukurydza",
        "name_pl": "Kukurydza na ziarno / kiszonkę",
        "kc_initial": 0.35,
        "kc_mid": 1.20,
        "kc_end": 0.60,
        "root_depth_m": 0.9,
        "drought_sensitivity": "WYSOKA",
        "critical_phase": "Kwitnienie i nalewanie ziarna (lipiec-sierpień)",
        "optimal_awc_mm": 120.0
    },
    "pszenica_ozima": {
        "id": "pszenica_ozima",
        "name_pl": "Pszenica ozima",
        "kc_initial": 0.40,
        "kc_mid": 1.15,
        "kc_end": 0.30,
        "root_depth_m": 1.0,
        "drought_sensitivity": "ŚREDNIA",
        "critical_phase": "Strzelanie w źdźbło i kłoszenie (maj-czerwiec)",
        "optimal_awc_mm": 110.0
    },
    "pszenica_jara": {
        "id": "pszenica_jara",
        "name_pl": "Pszenica jara",
        "kc_initial": 0.35,
        "kc_mid": 1.15,
        "kc_end": 0.30,
        "root_depth_m": 0.8,
        "drought_sensitivity": "WYSOKA",
        "critical_phase": "Kłoszenie i nalewanie ziarna (czerwiec-lipiec)",
        "optimal_awc_mm": 110.0
    },
    "rzepak": {
        "id": "rzepak",
        "name_pl": "Rzepak ozimy",
        "kc_initial": 0.35,
        "kc_mid": 1.10,
        "kc_end": 0.35,
        "root_depth_m": 1.2,
        "drought_sensitivity": "ŚREDNIA",
        "critical_phase": "Kwitnienie i zawiązywanie łuszczyn (kwiecień-maj)",
        "optimal_awc_mm": 130.0
    },
    "burak_cukrowy": {
        "id": "burak_cukrowy",
        "name_pl": "Burak cukrowy",
        "kc_initial": 0.35,
        "kc_mid": 1.20,
        "kc_end": 0.70,
        "root_depth_m": 1.0,
        "drought_sensitivity": "WYSOKA",
        "critical_phase": "Zwarcie międzyrzędzi i przyrost korzenia (lipiec-sierpień)",
        "optimal_awc_mm": 140.0
    },
    "ziemniak": {
        "id": "ziemniak",
        "name_pl": "Ziemniak",
        "kc_initial": 0.45,
        "kc_mid": 1.15,
        "kc_end": 0.75,
        "root_depth_m": 0.6,
        "drought_sensitivity": "BARDZO WYSOKA",
        "critical_phase": "Zawiązywanie i przyrost bulw (czerwiec-sierpień)",
        "optimal_awc_mm": 100.0
    },
    "jeczmien": {
        "id": "jeczmien",
        "name_pl": "Jęczmień",
        "kc_initial": 0.30,
        "kc_mid": 1.15,
        "kc_end": 0.25,
        "root_depth_m": 0.8,
        "drought_sensitivity": "ŚREDNIA",
        "critical_phase": "Kłoszenie (maj-czerwiec)",
        "optimal_awc_mm": 100.0
    },
    "zyto": {
        "id": "zyto",
        "name_pl": "Żyto ozime",
        "kc_initial": 0.30,
        "kc_mid": 1.05,
        "kc_end": 0.25,
        "root_depth_m": 1.1,
        "drought_sensitivity": "NISKA",
        "critical_phase": "Strzelanie w źdźbło (maj)",
        "optimal_awc_mm": 90.0
    },
    "soja": {
        "id": "soja",
        "name_pl": "Soja",
        "kc_initial": 0.35,
        "kc_mid": 1.15,
        "kc_end": 0.50,
        "root_depth_m": 0.8,
        "drought_sensitivity": "WYSOKA",
        "critical_phase": "Kwitnienie i wiązanie strąków (lipiec-sierpień)",
        "optimal_awc_mm": 120.0
    },
    "laka": {
        "id": "laka",
        "name_pl": "Trwałe użytki zielone (łąki / pastwiska)",
        "kc_initial": 0.60,
        "kc_mid": 1.00,
        "kc_end": 0.85,
        "root_depth_m": 0.5,
        "drought_sensitivity": "ŚREDNIA",
        "critical_phase": "Odrost po pokosach (cały sezon wegetacyjny)",
        "optimal_awc_mm": 110.0
    }
}

def get_crop_kc(crop_name: str, month: int = 7) -> float:
    """
    Zwraca odpowiedni współczynnik Kc dla danej uprawy w zależności od miesiąca (okresu wegetacji).
    Miesiące:
    - 4 (kwiecień): faza początkowa
    - 5-6 (maj-czerwiec): intensywny wzrost
    - 7-8 (lipiec-sierpień): faza środkowa (mid)
    - 9-10 (wrzesień-październik): faza końcowa (end)
    """
    crop_key = crop_name.lower().replace(" ", "_").replace("-", "_")
    crop = CROP_DATABASE.get(crop_key, CROP_DATABASE["kukurydza"])
    
    if month <= 4:
        return crop["kc_initial"]
    elif month in [5, 6]:
        return (crop["kc_initial"] + crop["kc_mid"]) / 2.0
    elif month in [7, 8]:
        return crop["kc_mid"]
    else:
        return crop["kc_end"]

