"""
Słownik upraw i współczynników roślinnych Kc (FAO-56) oraz referencyjnych wartości NDVI.
Dostosowany do specyfiki agroklimatycznej Polski:
- rozróżnienie form ozimych i jarych
- uwzględnienie okresu pożniwnego / ścierniska (sierpień)
- spoczynek zimowy
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
        "optimal_awc_mm": 120.0,
        "ndvi_reference": {
            "early": 0.30,
            "mid": 0.82,
            "late": 0.45
        }
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
        "optimal_awc_mm": 110.0,
        "ndvi_reference": {
            "early": 0.65,
            "mid": 0.78,
            "late": 0.25
        }
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
        "optimal_awc_mm": 110.0,
        "ndvi_reference": {
            "early": 0.40,
            "mid": 0.75,
            "late": 0.30
        }
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
        "optimal_awc_mm": 130.0,
        "ndvi_reference": {
            "early": 0.70,
            "mid": 0.75,
            "late": 0.25
        }
    },
    "rzepak_ozimy": {
        "id": "rzepak_ozimy",
        "name_pl": "Rzepak ozimy",
        "kc_initial": 0.35,
        "kc_mid": 1.10,
        "kc_end": 0.35,
        "root_depth_m": 1.2,
        "drought_sensitivity": "ŚREDNIA",
        "critical_phase": "Kwitnienie i zawiązywanie łuszczyn (kwiecień-maj)",
        "optimal_awc_mm": 130.0,
        "ndvi_reference": {
            "early": 0.70,
            "mid": 0.75,
            "late": 0.25
        }
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
        "optimal_awc_mm": 140.0,
        "ndvi_reference": {
            "early": 0.35,
            "mid": 0.80,
            "late": 0.65
        }
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
        "optimal_awc_mm": 100.0,
        "ndvi_reference": {
            "early": 0.40,
            "mid": 0.75,
            "late": 0.40
        }
    },
    "jeczmien": {
        "id": "jeczmien",
        "name_pl": "Jęczmień jary",
        "kc_initial": 0.30,
        "kc_mid": 1.15,
        "kc_end": 0.25,
        "root_depth_m": 0.8,
        "drought_sensitivity": "ŚREDNIA",
        "critical_phase": "Kłoszenie (maj-czerwiec)",
        "optimal_awc_mm": 100.0,
        "ndvi_reference": {
            "early": 0.55,
            "mid": 0.72,
            "late": 0.25
        }
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
        "optimal_awc_mm": 90.0,
        "ndvi_reference": {
            "early": 0.60,
            "mid": 0.70,
            "late": 0.25
        }
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
        "optimal_awc_mm": 120.0,
        "ndvi_reference": {
            "early": 0.30,
            "mid": 0.78,
            "late": 0.50
        }
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
        "optimal_awc_mm": 110.0,
        "ndvi_reference": {
            "early": 0.65,
            "mid": 0.75,
            "late": 0.60
        }
    }
}

# Harmonogramy miesięczne współczynnika ewapotranspiracji uprawy (Kc) wg FAO-56
# Klucze: numery miesięcy (1 do 12)
CROP_KC_SCHEDULE = {
    "pszenica ozima": {
        1: 0.30, 2: 0.35, 3: 0.70, 4: 0.95, 5: 1.15, 6: 1.10, 7: 0.45, 8: 0.30, 9: 0.40, 10: 0.70, 11: 0.50, 12: 0.35
    },
    "pszenica jara": {
        1: 0.20, 2: 0.20, 3: 0.30, 4: 0.45, 5: 0.85, 6: 1.15, 7: 0.95, 8: 0.25, 9: 0.20, 10: 0.20, 11: 0.20, 12: 0.20
    },
    "rzepak ozimy": {
        1: 0.30, 2: 0.35, 3: 0.75, 4: 1.10, 5: 1.15, 6: 0.75, 7: 0.30, 8: 0.25, 9: 0.35, 10: 0.60, 11: 0.50, 12: 0.35
    },
    "kukurydza": {
        1: 0.20, 2: 0.20, 3: 0.20, 4: 0.35, 5: 0.45, 6: 0.90, 7: 1.20, 8: 1.10, 9: 0.60, 10: 0.25, 11: 0.20, 12: 0.20
    },
    "burak cukrowy": {
        1: 0.20, 2: 0.20, 3: 0.20, 4: 0.35, 5: 0.70, 6: 1.05, 7: 1.20, 8: 1.15, 9: 0.90, 10: 0.50, 11: 0.25, 12: 0.20
    },
    "ziemniak": {
        1: 0.20, 2: 0.20, 3: 0.20, 4: 0.30, 5: 0.50, 6: 1.05, 7: 1.15, 8: 0.85, 9: 0.45, 10: 0.20, 11: 0.20, 12: 0.20
    },
    "żyto": {
        1: 0.30, 2: 0.35, 3: 0.65, 4: 0.90, 5: 1.10, 6: 1.05, 7: 0.45, 8: 0.30, 9: 0.40, 10: 0.65, 11: 0.50, 12: 0.35
    },
    "jęczmień jary": {
        1: 0.20, 2: 0.20, 3: 0.30, 4: 0.45, 5: 0.85, 6: 1.10, 7: 0.80, 8: 0.25, 9: 0.20, 10: 0.20, 11: 0.20, 12: 0.20
    },
    "soja": {
        1: 0.20, 2: 0.20, 3: 0.20, 4: 0.30, 5: 0.45, 6: 0.85, 7: 1.15, 8: 1.10, 9: 0.50, 10: 0.25, 11: 0.20, 12: 0.20
    },
    "trwałe użytki zielone": {
        1: 0.40, 2: 0.40, 3: 0.60, 4: 0.80, 5: 1.00, 6: 1.00, 7: 1.00, 8: 1.00, 9: 0.85, 10: 0.65, 11: 0.45, 12: 0.40
    }
}

# Normy referencyjne NDVI (wartości medianowe z satelity Sentinel-2 dla zdrowej uprawy w Polsce)
CROP_NDVI_REFERENCE = {
    "pszenica ozima": {
        1: 0.25, 2: 0.30, 3: 0.50, 4: 0.72, 5: 0.85, 6: 0.80, 7: 0.45, 8: 0.22, 9: 0.30, 10: 0.55, 11: 0.45, 12: 0.30
    },
    "pszenica jara": {
        1: 0.15, 2: 0.15, 3: 0.20, 4: 0.35, 5: 0.65, 6: 0.82, 7: 0.75, 8: 0.25, 9: 0.18, 10: 0.18, 11: 0.15, 12: 0.15
    },
    "rzepak ozimy": {
        1: 0.25, 2: 0.32, 3: 0.60, 4: 0.82, 5: 0.88, 6: 0.55, 7: 0.25, 8: 0.20, 9: 0.30, 10: 0.50, 11: 0.45, 12: 0.30
    },
    "kukurydza": {
        1: 0.15, 2: 0.15, 3: 0.15, 4: 0.20, 5: 0.35, 6: 0.75, 7: 0.88, 8: 0.85, 9: 0.50, 10: 0.22, 11: 0.15, 12: 0.15
    },
    "burak cukrowy": {
        1: 0.15, 2: 0.15, 3: 0.15, 4: 0.25, 5: 0.50, 6: 0.80, 7: 0.88, 8: 0.85, 9: 0.75, 10: 0.40, 11: 0.20, 12: 0.15
    },
    "ziemniak": {
        1: 0.15, 2: 0.15, 3: 0.15, 4: 0.20, 5: 0.40, 6: 0.82, 7: 0.85, 8: 0.65, 9: 0.30, 10: 0.18, 11: 0.15, 12: 0.15
    },
    "żyto": {
        1: 0.30, 2: 0.35, 3: 0.55, 4: 0.75, 5: 0.85, 6: 0.78, 7: 0.45, 8: 0.22, 9: 0.30, 10: 0.55, 11: 0.45, 12: 0.30
    },
    "jęczmień jary": {
        1: 0.15, 2: 0.15, 3: 0.20, 4: 0.35, 5: 0.65, 6: 0.80, 7: 0.60, 8: 0.25, 9: 0.18, 10: 0.18, 11: 0.15, 12: 0.15
    },
    "soja": {
        1: 0.15, 2: 0.15, 3: 0.15, 4: 0.20, 5: 0.30, 6: 0.70, 7: 0.80, 8: 0.78, 9: 0.50, 10: 0.20, 11: 0.15, 12: 0.15
    },
    "trwałe użytki zielone": {
        1: 0.35, 2: 0.35, 3: 0.45, 4: 0.65, 5: 0.80, 6: 0.80, 7: 0.75, 8: 0.75, 9: 0.70, 10: 0.55, 11: 0.40, 12: 0.35
    }
}


def normalize_crop_name(crop_name: str) -> str:
    """Normalizuje nazwę uprawy do klucza słownikowego harmonogramów."""
    if not crop_name:
        return "pszenica ozima"

    cleaned = crop_name.lower().replace("-", "_").strip()
    
    mapping = {
        "pszenica_ozima": "pszenica ozima",
        "pszenica ozima": "pszenica ozima",
        "pszenica_jara": "pszenica jara",
        "pszenica jara": "pszenica jara",
        "pszenica": "pszenica ozima",
        "rzepak_ozimy": "rzepak ozimy",
        "rzepak ozimy": "rzepak ozimy",
        "rzepak": "rzepak ozimy",
        "kukurydza": "kukurydza",
        "burak_cukrowy": "burak cukrowy",
        "burak cukrowy": "burak cukrowy",
        "burak": "burak cukrowy",
        "ziemniak": "ziemniak",
        "ziemniaki": "ziemniak",
        "ziemiak": "ziemniak",
        "żyto": "żyto",
        "zyto": "żyto",
        "jęczmień_jary": "jęczmień jary",
        "jęczmień jary": "jęczmień jary",
        "jeczmien": "jęczmień jary",
        "jęczmień": "jęczmień jary",
        "soja": "soja",
        "laka": "trwałe użytki zielone",
        "łąka": "trwałe użytki zielone",
        "trwałe użytki zielone": "trwałe użytki zielone"
    }

    for key, val in mapping.items():
        if key in cleaned:
            return val

    return "pszenica ozima"


def get_crop_kc(crop_name: str, month: int = 7) -> float:
    """Zwraca współczynnik Kc dla danej uprawy i miesiąca wg FAO-56."""
    crop_key = normalize_crop_name(crop_name)
    schedule = CROP_KC_SCHEDULE.get(crop_key, CROP_KC_SCHEDULE["pszenica ozima"])
    return schedule.get(month, 0.50)


def get_crop_ndvi_reference(crop_name: str, month: int = 7) -> float:
    """Zwraca referencyjną (zdrową) wartość NDVI dla danej uprawy i miesiąca."""
    crop_key = normalize_crop_name(crop_name)
    schedule = CROP_NDVI_REFERENCE.get(crop_key, CROP_NDVI_REFERENCE["pszenica ozima"])
    return schedule.get(month, 0.50)
