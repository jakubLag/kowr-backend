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

# ----------------- ANALYZE SCHEMAS -----------------

class AnalyzeRequest(BaseModel):
    teryt: str = Field(..., description="Format TERYT: WWPPGG_R.OOOO.NR_DZIAŁKI", json_schema_extra={"example": "141201_1.0001.123/4"})
    crop: str = Field(default="kukurydza", description="Gatunek uprawy (np. kukurydza, pszenica_ozima, rzepak)")
    target_date: Optional[str] = Field(default=None, description="Data analizy w formacie YYYY-MM-DD (domyślnie bieżąca data)")

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
