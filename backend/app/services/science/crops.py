"""
Słownik współczynników roślinnych Kc (FAO-56), miesięcznych referencyjnych wartości NDVI
oraz faz fenologicznych dla 10 głównych upraw w Polsce, oparty na wytycznych
monitoringowych Copernicus / IUNG-PIB i w pełni zsynchronizowany z frontendem (crops.ts).
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
        "kc_by_month": {
            1: 0.25, 2: 0.25, 3: 0.25, 4: 0.30, 5: 0.45, 6: 0.85,
            7: 1.20, 8: 1.20, 9: 0.85, 10: 0.50, 11: 0.25, 12: 0.25,
        },
        "ndvi_by_month": {
            1: 0.20, 2: 0.20, 3: 0.20, 4: 0.22, 5: 0.32, 6: 0.62,
            7: 0.82, 8: 0.80, 9: 0.52, 10: 0.30, 11: 0.22, 12: 0.20,
        },
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
        "kc_by_month": {
            1: 0.35, 2: 0.35, 3: 0.50, 4: 0.85, 5: 1.15, 6: 1.15,
            7: 0.60, 8: 0.25, 9: 0.30, 10: 0.40, 11: 0.40, 12: 0.35,
        },
        "ndvi_by_month": {
            1: 0.35, 2: 0.35, 3: 0.48, 4: 0.68, 5: 0.80, 6: 0.78,
            7: 0.48, 8: 0.25, 9: 0.25, 10: 0.38, 11: 0.42, 12: 0.36,
        },
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
        "kc_by_month": {
            1: 0.25, 2: 0.25, 3: 0.30, 4: 0.45, 5: 0.85, 6: 1.15,
            7: 1.10, 8: 0.45, 9: 0.25, 10: 0.25, 11: 0.25, 12: 0.25,
        },
        "ndvi_by_month": {
            1: 0.20, 2: 0.20, 3: 0.22, 4: 0.35, 5: 0.58, 6: 0.76,
            7: 0.72, 8: 0.32, 9: 0.24, 10: 0.22, 11: 0.20, 12: 0.20,
        },
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
        "kc_by_month": {
            1: 0.35, 2: 0.35, 3: 0.55, 4: 1.05, 5: 1.10, 6: 0.70,
            7: 0.35, 8: 0.25, 9: 0.40, 10: 0.50, 11: 0.45, 12: 0.35,
        },
        "ndvi_by_month": {
            1: 0.40, 2: 0.40, 3: 0.54, 4: 0.72, 5: 0.76, 6: 0.55,
            7: 0.28, 8: 0.25, 9: 0.40, 10: 0.55, 11: 0.52, 12: 0.42,
        },
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
        "kc_by_month": {
            1: 0.25, 2: 0.25, 3: 0.25, 4: 0.35, 5: 0.55, 6: 0.95,
            7: 1.20, 8: 1.20, 9: 0.95, 10: 0.70, 11: 0.30, 12: 0.25,
        },
        "ndvi_by_month": {
            1: 0.20, 2: 0.20, 3: 0.20, 4: 0.24, 5: 0.38, 6: 0.65,
            7: 0.80, 8: 0.80, 9: 0.70, 10: 0.52, 11: 0.25, 12: 0.20,
        },
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
        "kc_by_month": {
            1: 0.25, 2: 0.25, 3: 0.25, 4: 0.40, 5: 0.65, 6: 1.05,
            7: 1.15, 8: 1.10, 9: 0.70, 10: 0.30, 11: 0.25, 12: 0.25,
        },
        "ndvi_by_month": {
            1: 0.20, 2: 0.20, 3: 0.20, 4: 0.25, 5: 0.42, 6: 0.72,
            7: 0.78, 8: 0.68, 9: 0.40, 10: 0.24, 11: 0.20, 12: 0.20,
        },
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
        "optimal_awc_mm": 100.0,
        "kc_by_month": {
            1: 0.30, 2: 0.30, 3: 0.40, 4: 0.70, 5: 1.10, 6: 1.15,
            7: 0.55, 8: 0.25, 9: 0.25, 10: 0.30, 11: 0.30, 12: 0.30,
        },
        "ndvi_by_month": {
            1: 0.30, 2: 0.30, 3: 0.42, 4: 0.60, 5: 0.75, 6: 0.74,
            7: 0.42, 8: 0.25, 9: 0.25, 10: 0.32, 11: 0.34, 12: 0.30,
        },
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
        "kc_by_month": {
            1: 0.30, 2: 0.30, 3: 0.45, 4: 0.85, 5: 1.05, 6: 1.00,
            7: 0.50, 8: 0.25, 9: 0.30, 10: 0.35, 11: 0.35, 12: 0.30,
        },
        "ndvi_by_month": {
            1: 0.32, 2: 0.32, 3: 0.46, 4: 0.64, 5: 0.74, 6: 0.70,
            7: 0.42, 8: 0.25, 9: 0.26, 10: 0.36, 11: 0.38, 12: 0.34,
        },
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
        "kc_by_month": {
            1: 0.25, 2: 0.25, 3: 0.25, 4: 0.30, 5: 0.45, 6: 0.85,
            7: 1.15, 8: 1.15, 9: 0.65, 10: 0.30, 11: 0.25, 12: 0.25,
        },
        "ndvi_by_month": {
            1: 0.20, 2: 0.20, 3: 0.20, 4: 0.22, 5: 0.32, 6: 0.58,
            7: 0.78, 8: 0.78, 9: 0.50, 10: 0.26, 11: 0.20, 12: 0.20,
        },
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
        "kc_by_month": {
            1: 0.40, 2: 0.40, 3: 0.55, 4: 0.80, 5: 1.00, 6: 1.00,
            7: 0.95, 8: 0.95, 9: 0.85, 10: 0.75, 11: 0.50, 12: 0.40,
        },
        "ndvi_by_month": {
            1: 0.45, 2: 0.45, 3: 0.55, 4: 0.68, 5: 0.76, 6: 0.76,
            7: 0.74, 8: 0.72, 9: 0.68, 10: 0.60, 11: 0.50, 12: 0.45,
        },
    },
}


def _normalize_crop_key(crop_name: str) -> str:
    return crop_name.lower().strip().replace(" ", "_").replace("-", "_")


def _clamp_month(month: int) -> int:
    return max(1, min(12, int(month)))


def get_crop_kc(crop_name: str, month: int = 7) -> float:
    """
    Zwraca miesięczny współczynnik roślinny Kc (FAO-56) z mapy `kc_by_month`,
    w 100% zsynchronizowany z frontendem (`frontend/src/lib/crops.ts`).
    """
    crop_key = _normalize_crop_key(crop_name)
    crop = CROP_DATABASE.get(crop_key, CROP_DATABASE["kukurydza"])
    m = _clamp_month(month)
    return float(crop["kc_by_month"][m])


def get_crop_ndvi_reference(crop_name: str, month: int = 7) -> float:
    """
    Zwraca referencyjną (zdrową) wartość NDVI dla danej uprawy i miesiąca
    z pełnej 12-miesięcznej mapy `ndvi_by_month`.
    """
    crop_key = _normalize_crop_key(crop_name)
    crop = CROP_DATABASE.get(crop_key, CROP_DATABASE["kukurydza"])
    m = _clamp_month(month)
    return float(crop["ndvi_by_month"][m])


def get_crop_growth_stage(crop_name: str, month: int) -> str:
    """
    Zwraca opis fazy rozwojowej zależny od gatunku uprawy i miesiąca
    (zsynchronizowany z `getMonthGrowthStageDescription` na froncie).
    """
    crop_key = _normalize_crop_key(crop_name)
    m = _clamp_month(month)

    # Zboża ozime (pszenica ozima, żyto ozime, jęczmień)
    if crop_key in ("pszenica_ozima", "zyto", "jeczmien"):
        if m <= 2 or m == 12:
            return "Spoczynek zimowy ozimin"
        if m == 3:
            return "Ruszenie wegetacji wiosennej i dokrzewianie"
        if m == 4:
            return "Strzelanie w źdźbło"
        if m in (5, 6):
            return "Kłoszenie, kwitnienie i nalewanie ziarna (faza krytyczna)"
        if m == 7:
            return "Dojrzewanie i początek żniw"
        if m == 8:
            return "Po żniwach / ściernisko"
        if m in (9, 10):
            return "Siew jesienny, wschody i krzewienie ozimin"
        return "Hartowanie jesienne przed zimą"

    # Rzepak ozimy
    if crop_key == "rzepak":
        if m <= 2 or m == 12:
            return "Spoczynek zimowy"
        if m == 3:
            return "Ruszenie wegetacji i wzrost pędu głównego"
        if m in (4, 5):
            return "Pąkowanie, kwitnienie i zawiązywanie łuszczyn (faza krytyczna)"
        if m == 6:
            return "Nalewanie nasion i początek dojrzewania"
        if m == 7:
            return "Dojrzewanie techniczne i zbiór rzepaku"
        if m == 8:
            return "Po zbiorach / siew rzepaku ozimego"
        if m in (9, 10):
            return "Budowa rozety liściowej jesienią"
        return "Wejście w spoczynek zimowy"

    # Pszenica jara
    if crop_key == "pszenica_jara":
        if m <= 3:
            return "Okres przedsiewny / siew wiosenny"
        if m == 4:
            return "Wschody i krzewienie"
        if m == 5:
            return "Strzelanie w źdźbło"
        if m in (6, 7):
            return "Kłoszenie, kwitnienie i nalewanie ziarna (faza krytyczna)"
        if m == 8:
            return "Dojrzewanie i żniwa zbóż jarych"
        return "Okres pożniwny / ściernisko lub międzyplon"

    # Kukurydza i soja
    if crop_key in ("kukurydza", "soja"):
        if m <= 3:
            return "Okres przedsiewny"
        if m in (4, 5):
            return "Siew, wschody i początkowy wzrost liści"
        if m == 6:
            return "Intensywny wzrost wegetatywny i zakrywanie międzyrzędzi"
        if m in (7, 8):
            return (
                "Kwitnienie i wiązanie strąków (faza krytyczna)"
                if crop_key == "soja"
                else "Kwitnienie (wiechowanie) i nalewanie ziarna (faza krytyczna)"
            )
        if m == 9:
            return "Dojrzewanie fizjologiczne"
        if m == 10:
            return "Zbiór i okres pożniwny"
        return "Okres po zbiorach (retencja jesienno-zimowa)"

    # Burak cukrowy
    if crop_key == "burak_cukrowy":
        if m <= 3:
            return "Okres przedsiewny"
        if m in (4, 5):
            return "Siew, wschody i formowanie rozety"
        if m == 6:
            return "Zwarcie międzyrzędzi"
        if m in (7, 8):
            return "Intensywny przyrost korzenia i gromadzenie cukru (faza krytyczna)"
        if m in (9, 10):
            return "Dojrzewanie technologiczne i wykopki"
        return "Okres po zbiorach (odbudowa zapasów wody)"

    # Ziemniak
    if crop_key == "ziemniak":
        if m <= 3:
            return "Okres przed sadzeniem"
        if m in (4, 5):
            return "Sadzenie, wschody i wzrost naci"
        if m in (6, 7, 8):
            return "Zawiązywanie i intensywny przyrost bulw (faza krytyczna)"
        if m == 9:
            return "Zasychanie naci i wykopki"
        return "Okres po zbiorach (retencja jesienno-zimowa)"

    # Trwałe użytki zielone (TUZ)
    if crop_key == "laka":
        if m <= 2 or m == 12:
            return "Spoczynek zimowy runi"
        if m == 3:
            return "Wczesnowiosenne ruszenie runi łąkowej"
        if 4 <= m <= 8:
            return "Intensywny wzrost runi i odrost po pokosach"
        if m in (9, 10):
            return "Jesienny odrost runi i przygotowanie do zimowania"
        return "Zakończenie wegetacji runi"

    # Domyślny opis
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
