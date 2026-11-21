"""
Moduł fenologii upraw i współczynników Kc (FAO-56) oraz referencyjnych NDVI.
Dostosowany do specyfiki agroklimatycznej Polski (rozróżnienie form ozimych i jarych, 
uwzględnienie okresu pożniwnego / ścierniska oraz spoczynku zimowego).
"""

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
        1: 0.20, 2: 0.20, 3: 0.20, 4: 0.30, 5: 0.45, 6: 0.90, 7: 1.20, 8: 1.10, 9: 0.60, 10: 0.25, 11: 0.20, 12: 0.20
    },
    "burak cukrowy": {
        1: 0.20, 2: 0.20, 3: 0.20, 4: 0.35, 5: 0.70, 6: 1.05, 7: 1.20, 8: 1.15, 9: 0.90, 10: 0.50, 11: 0.25, 12: 0.20
    },
    "ziemiak": {
        1: 0.20, 2: 0.20, 3: 0.20, 4: 0.30, 5: 0.50, 6: 1.05, 7: 1.15, 8: 0.85, 9: 0.45, 10: 0.20, 11: 0.20, 12: 0.20
    },
    "żyto": {
        1: 0.30, 2: 0.35, 3: 0.65, 4: 0.90, 5: 1.10, 6: 1.05, 7: 0.45, 8: 0.30, 9: 0.40, 10: 0.65, 11: 0.50, 12: 0.35
    },
    "jęczmień jary": {
        1: 0.20, 2: 0.20, 3: 0.30, 4: 0.45, 5: 0.85, 6: 1.10, 7: 0.80, 8: 0.25, 9: 0.20, 10: 0.20, 11: 0.20, 12: 0.20
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
    "ziemiak": {
        1: 0.15, 2: 0.15, 3: 0.15, 4: 0.20, 5: 0.40, 6: 0.82, 7: 0.85, 8: 0.65, 9: 0.30, 10: 0.18, 11: 0.15, 12: 0.15
    },
    "żyto": {
        1: 0.30, 2: 0.35, 3: 0.55, 4: 0.75, 5: 0.85, 6: 0.78, 7: 0.45, 8: 0.22, 9: 0.30, 10: 0.55, 11: 0.45, 12: 0.30
    },
    "jęczmień jary": {
        1: 0.15, 2: 0.15, 3: 0.20, 4: 0.35, 5: 0.65, 6: 0.80, 7: 0.60, 8: 0.25, 9: 0.18, 10: 0.18, 11: 0.15, 12: 0.15
    }
}

def normalize_crop_name(crop_name: str) -> str:
    """Normalizuje nazwę uprawy do klucza słownikowego (usuwa wielkość liter, polskie znaki itp.)."""
    if not crop_name:
        return "pszenica ozima"  # Domyślny fallback
    
    cleaned = crop_name.lower().strip()
    # Mapowania alternatywnych nazw od użytkownika / frontendu
    mapping = {
        "pszenica": "pszenica ozima",
        "pszenica ozima": "pszenica ozima",
        "pszenica jara": "pszenica jara",
        "rzepak": "rzepak ozimy",
        "rzepak ozimy": "rzepak ozimy",
        "kukurydza": "kukurydza",
        "burak": "burak cukrowy",
        "burak cukrowy": "burak cukrowy",
        "ziemniak": "ziemiak",
        "ziemniaki": "ziemiak",
        "żyto": "żyto",
        "jęczmień": "jęczmień jary",
        "jęczmień jary": "jęczmień jary"
    }
    
    for key, val in mapping.items():
        if key in cleaned:
            return val
            
    return "pszenica ozima"  # Uniwersalny domyślny fallback dla zbóż

def get_crop_kc(crop_name: str, month: int) -> float:
    """Zwraca współczynnik Kc dla danej uprawy i miesiąca."""
    crop_key = normalize_crop_name(crop_name)
    schedule = CROP_KC_SCHEDULE.get(crop_key, CROP_KC_SCHEDULE["pszenica ozima"])
    return schedule.get(month, 0.50)

def get_crop_ndvi_reference(crop_name: str, month: int) -> float:
    """Zwraca referencyjną wartość NDVI dla danej uprawy i miesiąca."""
    crop_key = normalize_crop_name(crop_name)
    schedule = CROP_NDVI_REFERENCE.get(crop_key, CROP_NDVI_REFERENCE["pszenica ozima"])
    return schedule.get(month, 0.50)