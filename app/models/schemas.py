from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field

# ----------------- PARCEL SCHEMAS -----------------

class PointCoordinates(BaseModel):
    lat: float = Field(..., description="Szerokość geograficzna (WGS84)")
    lon: float = Field(..., description="Długość geograficzna (WGS84)")

class ParcelGeometry(BaseModel):
    type: str = Field(..., description="Typ geometrii GeoJSON, np. Polygon lub MultiPolygon")
    coordinates: Any = Field(..., description="Współrzędne w układzie WGS84 (EPSG:4326)")

class ParcelSearchResponse(BaseModel):
    teryt: str = Field(..., description="Pełny identyfikator TERYT działki")
    voivodeship: Optional[str] = Field(None, description="Województwo")
    county: Optional[str] = Field(None, description="Powiat")
    commune: Optional[str] = Field(None, description="Gmina")
    precinct: Optional[str] = Field(None, description="Obręb")
    parcel_number: Optional[str] = Field(None, description="Numer działki")
    area_ha: float = Field(..., description="Pole powierzchni działki w hektarach")
    center: PointCoordinates = Field(..., description="Reprezentatywny punkt działki (do wycentrowania mapy)")
    geometry: ParcelGeometry = Field(..., description="Geometria GeoJSON w układzie EPSG:4326")
    wkt_2180: Optional[str] = Field(None, description="Oryginalna geometria WKT z ULDK w układzie EPSG:2180")
    is_fallback: bool = Field(default=False, description="Czy geometria i współrzędne zostały wygenerowane z modelu TERYT (np. w przypadku blokady/awarii ULDK)")

# ----------------- ANALYZE SCHEMAS -----------------

class AnalyzeRequest(BaseModel):
    teryt: str = Field(..., description="Format TERYT: WWPPGG_R.OOOO.NR_DZIAŁKI", json_schema_extra={"example": "141201_1.0001.123/4"})
    crop: str = Field(default="kukurydza", description="Gatunek uprawy (np. kukurydza, pszenica_ozima, rzepak)")
    target_date: Optional[str] = Field(default=None, description="Data analizy w formacie YYYY-MM-DD (domyślnie bieżąca data)")
    ditch_distance_m: Optional[float] = Field(default=None, description="Opcjonalna odległość do rowu melioracyjnego w metrach (np. podana z mapy Geoportalu)")

class DailyWeatherPoint(BaseModel):
    date: str = Field(..., description="Data w formacie YYYY-MM-DD")
    precipitation_mm: float = Field(..., description="Dobowa suma opadów (mm)")
    et0_mm: float = Field(..., description="Dobowa ewapotranspiracja referencyjna ET0 (mm)")
    kbw_daily_mm: float = Field(..., description="Dobowy bilans wodny P - ET0*Kc (mm)")
    kbw_cumulative_mm: float = Field(..., description="Skumulowany bilans wodny KBW (mm)")
    is_forecast: bool = Field(default=False, description="True dla prognozy 60-dniowej, False dla historii")
    temp_max_c: Optional[float] = Field(None, description="Średnia/maksymalna temperatura dobowa (°C)")
    wind_max_ms: Optional[float] = Field(None, description="Maksymalna prędkość wiatru (m/s)")

class DecadeForecastPoint(BaseModel):
    decade_number: int = Field(..., description="Numer dekady prognozy (1..6, czyli +10..+60 dni)")
    period_label: str = Field(..., description="Etykieta okresu (np. I dekada: +1–10 dni)")
    start_date: str = Field(..., description="Początek dekady YYYY-MM-DD")
    end_date: str = Field(..., description="Koniec dekady YYYY-MM-DD")
    crop_kc: float = Field(..., description="Współczynnik roślinny Kc w danej dekadzie")
    growth_stage: str = Field(..., description="Faza rozwojowa uprawy w danej dekadzie")
    precipitation_mm: float = Field(..., description="Prognozowana suma opadów w dekadzie (mm)")
    et0_mm: float = Field(..., description="Prognozowane parowanie referencyjne ET0 w dekadzie (mm)")
    etc_mm: float = Field(..., description="Zapotrzebowanie wodne łanu ETc = ET0 * Kc (mm)")
    kbw_decade_mm: float = Field(..., description="Bilans dekady P - ETc (mm)")
    kbw_60d_rolling_mm: float = Field(..., description="Prognozowany 60-dniowy bilans kroczący KBW na koniec dekady (mm)")
    risk_status: str = Field(..., description="Ocena ryzyka i rekomendacja na dekadę")

class Diagnosis(BaseModel):
    kbw_30d_mm: float = Field(..., description="Klimatyczny Bilans Wodny za ostatnie 30 dni (mm)")
    kbw_60d_mm: float = Field(..., description="Klimatyczny Bilans Wodny za ostatnie 60 dni (mm)")
    kbw_status: str = Field(..., description="Ocena bilansu wodnego (np. Głęboki deficyt, Deficyt umiarkowany, Równowaga)")
    drought_risk_level: str = Field(..., description="Poziom ryzyka suszy: WYSOKIE, UMIARKOWANE, NISKIE")
    awc_mm: float = Field(..., description="Polowa Pojemność Wodna (AWC) gleby do głębokości 30 cm w mm")
    soil_category: str = Field(..., description="Kategoria agronomiczna gleby (bardzo lekka, lekka, średnia, ciężka)")
    soil_texture: str = Field(..., description="Uziarnienie gleby wg USDA / PTG (np. piasek gliniasty, glina lekka)")
    ndvi_current: Optional[float] = Field(None, description="Aktualny wskaźnik NDVI z satelity Sentinel-2")
    ndvi_historical_median: Optional[float] = Field(None, description="Mediana wieloletnia NDVI dla tego okresu")
    ndvi_anomaly_percent: Optional[float] = Field(None, description="Odchylenie NDVI od normy (%)")
    ndmi_current: Optional[float] = Field(None, description="Wskaźnik uwilgotnienia NDMI")
    slope_percent: float = Field(..., description="Średni spadek terenu działki (%)")
    distance_to_ditch_m: Optional[float] = Field(None, description="Odległość do najbliższego rowu/cieku w buforze 500m (m)")
    primary_causes: List[str] = Field(..., description="Główne przyczyny deficytu wody zidentyfikowane na działce")
    precipitation_30d_mm: Optional[float] = Field(None, description="Suma opadów z ostatnich 30 dni (mm)")
    et0_30d_mm: Optional[float] = Field(None, description="Suma ET0 z ostatnich 30 dni (mm)")
    forecast_7d_precip_mm: Optional[float] = Field(None, description="Prognozowana suma opadów na 7 dni (mm)")
    forecast_7d_et0_mm: Optional[float] = Field(None, description="Prognozowana suma ET0 na 7 dni (mm)")
    forecast_60d_precip_mm: Optional[float] = Field(None, description="Prognozowana suma opadów na 60 dni (mm)")
    forecast_60d_et0_mm: Optional[float] = Field(None, description="Prognozowana suma ET0 na 60 dni (mm)")
    forecast_60d_kbw_mm: Optional[float] = Field(None, description="Prognozowany bilans KBW za 60 dni (mm)")
    critical_threshold_kbw_60d_mm: Optional[float] = Field(None, description="Próg krytyczny suszy IUNG-PIB dla danej kategorii gleby (mm)")
    daily_weather_series: Optional[List[DailyWeatherPoint]] = Field(default=None, description="Szereg czasowy: 60 dni historii + 60 dni prognozy długoterminowej")
    forecast_60d_decades: Optional[List[DecadeForecastPoint]] = Field(default=None, description="Prognoza długoterminowa na 60 dni w podziale na 6 dekad (po 10 dni)")

class RetentionAction(BaseModel):
    id: str = Field(..., description="Unikalny identyfikator reguły")
    title: str = Field(..., description="Tytuł zalecenia")
    badge: str = Field(..., description="Kategoria i priorytet (np. Retencja krajobrazowa - Priorytet 1)")
    why: str = Field(..., description="Dlaczego zalecamy (uzasadnienie oparte o twarde dane z działki)")
    action: str = Field(..., description="Konkretne działanie agrotechniczne lub inwestycyjne dla rolnika")
    priority: int = Field(..., description="Waga priorytetu (1 = najwyższy)")
    category: str = Field(..., description="Kategoria: landscape | soil | micro_storage")

class IrrigationRecommendation(BaseModel):
    needed: bool = Field(..., description="Czy nawadnianie interwencyjne jest wymagane")
    status: str = Field(..., description="Status zalecenia nawadniania")
    dose_mm: float = Field(..., description="Zalecana dawka interwencyjna wody w mm")
    dose_m3_per_ha: float = Field(..., description="Zalecana dawka w m3 na hektar")
    recommended_timing: str = Field(..., description="Sugerowana pora / okno zabiegu")
    recommended_technique: str = Field(..., description="Rekomendowana technika (kropelkowe, deszczownia niskociśnieniowa)")
    justification: str = Field(..., description="Uzasadnienie dawki w oparciu o AWC i KBW")

class ReportMetadata(BaseModel):
    sources: List[str] = Field(..., description="Jawny wykaz źródeł danych przestrzennych i meteo")
    analysis_date: str = Field(..., description="Data wygenerowania analizy")
    sentinel_scene_date: Optional[str] = Field(None, description="Data zobrazowania Sentinel-2")
    cloud_cover_percent: Optional[float] = Field(None, description="Stopień zachmurzenia sceny")
    limitations: List[str] = Field(default_factory=list, description="Lista ograniczeń i zastrzeżeń metodycznych")
    execution_time_ms: int = Field(..., description="Czas wykonania obliczeń na backendzie w ms")

class AnalysisResponse(BaseModel):
    teryt: str = Field(..., description="Identyfikator TERYT")
    crop: str = Field(..., description="Nazwa uprawy")
    kc_coefficient: float = Field(..., description="Przyjęty współczynnik roślinny Kc")
    parcel_info: ParcelSearchResponse = Field(..., description="Dane przestrzenne działki")
    step1_diagnosis: Diagnosis = Field(..., description="Etap 1: Diagnoza stanu wody i przyczyny deficytu")
    step2_retention: List[RetentionAction] = Field(..., description="Etap 2: Dobór działań retencyjnych i agrotechnicznych")
    step3_irrigation: IrrigationRecommendation = Field(..., description="Etap 3: Opcjonalne rekomendacje nawadniania")
    metadata: ReportMetadata = Field(..., description="Metadane, transparentność i ograniczenia")

# ----------------- HEALTH SCHEMAS -----------------

class HealthResponse(BaseModel):
    status: str
    services: Dict[str, bool]
    timestamp: str

# ----------------- CROPS SCHEMAS -----------------

class CropInfo(BaseModel):
    id: str
    name_pl: str
    kc_initial: float
    kc_mid: float
    kc_end: float
    root_depth_m: float
    drought_sensitivity: str
