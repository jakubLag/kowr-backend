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

class Climatology10yYearPoint(BaseModel):
    year: int = Field(..., description="Rok sezonu wegetacyjnego")
    season_kbw_mm: float = Field(..., description="Najniższy 60-dniowy KBW w sezonie IV-IX (mm)")
    drought_occurred: bool = Field(..., description="Czy przekroczono próg krytyczny suszy IUNG")


class Climatology10y(BaseModel):
    drought_years_count: int = Field(..., description="Liczba lat z suszą rolniczą w analizowanym okresie")
    total_years_analyzed: int = Field(..., description="Liczba przeanalizowanych lat")
    historical_vulnerability_level: str = Field(..., description="WYSOKA | UMIARKOWANA | NISKA")
    peak_risk_months: List[str] = Field(default_factory=list, description="Miesiące o największym deficycie wody")
    max_dry_spell_days_30d: Optional[int] = Field(None, description="Najdłuższy ciąg dni bezopadowych (<1mm) w 30 dniach")
    avg_max_dry_spell_10y: Optional[float] = Field(None, description="Średni najdłuższy ciąg dni bezopadowych z 10 lat")
    kbw_60d_10y_median_mm: Optional[float] = Field(None, description="10-letnia mediana 60-dniowego KBW dla tej pory roku")
    yearly_series: Optional[List[Climatology10yYearPoint]] = Field(default=None, description="Seria roczna min. KBW sezonu IV-IX")


class ClimateVulnerability10Y(BaseModel):
    drought_frequency_years: str = Field(..., description="Częstość występowania suszy rolniczej, np. '7 na 10 lat'")
    drought_frequency_percent: int = Field(..., description="Procent lat z suszą w ostatnim 10-leciu (np. 70%)")
    most_critical_month: str = Field(..., description="Miesiąc o największym statystycznym deficycie wody (np. 'Lipiec')")
    average_summer_kbw_mm: float = Field(..., description="Średni Klimatyczny Bilans Wodny sezonu letniego (maj-sierpień) w 10-leciu")
    max_dry_spell_days: int = Field(..., description="Najdłuższy ciąg dni bezopadowych (<1mm) w historii wieloletniej")
    vulnerability_class: str = Field(..., description="Klasa podatności: BARDZO WYSOKA | WYSOKA | UMIARKOWANA | NISKA")
    summary_text: str = Field(..., description="Syntetyczny wniosek dla rolnika")

class Diagnosis(BaseModel):
    kbw_30d_mm: float = Field(..., description="Klimatyczny Bilans Wodny za ostatnie 30 dni (mm)")
    kbw_60d_mm: float = Field(..., description="Klimatyczny Bilans Wodny za ostatnie 60 dni (mm)")
    kbw_status: str = Field(..., description="Ocena bilansu wodnego (np. Głęboki deficyt, Deficyt umiarkowany, Równowaga)")
    drought_risk_level: str = Field(..., description="Poziom ryzyka suszy: WYSOKIE, UMIARKOWANE, NISKIE")
    awc_mm: float = Field(..., description="Polowa Pojemność Wodna (AWC) gleby do głębokości 30 cm w mm")
    soil_category: str = Field(..., description="Kategoria agronomiczna gleby (bardzo lekka, lekka, średnia, ciężka)")
    soil_texture: str = Field(..., description="Uziarnienie gleby wg USDA / PTG (np. piasek gliniasty, glina lekka)")
    ndvi_current: Optional[float] = Field(None, description="Aktualny wskaźnik NDVI z satelity Sentinel-2")
    ndvi_historical_median: Optional[float] = Field(None, description="Wzorzec referencyjny NDVI dla uprawy i fazy fenologicznej (Copernicus/IUNG-PIB)")
    ndvi_anomaly_percent: Optional[float] = Field(None, description="Odchylenie NDVI od normy (%)")
    ndmi_current: Optional[float] = Field(None, description="Wskaźnik uwilgotnienia NDMI")
    slope_percent: Optional[float] = Field(None, description="Średni spadek terenu działki (%) z modelu DEM; None przy niedostępności DEM")
    aspect_direction: Optional[str] = Field(None, description="Główny kierunek spływu powierzchniowego (np. południowo-zachodni)")
    distance_to_ditch_m: Optional[float] = Field(None, description="Odległość do najbliższego rowu/cieku w buforze 500m (m)")
    nearest_river: Optional[str] = Field(None, description="Nazwa najbliższej rzeki (stacja IMGW-PIB)")
    river_distance_m: Optional[float] = Field(None, description="Odległość do najbliższej rzeki/stacji wodowskazowej (m)")
    water_level_cm: Optional[float] = Field(None, description="Aktualny stan wody na rzece wg IMGW (cm)")
    nearest_waterway_coords: Optional[List[List[float]]] = Field(None, description="Współrzędne [lat, lon] linii najbliższego cieku/rowu (Overpass OSM)")
    nearest_waterway_point: Optional[List[float]] = Field(None, description="Współrzędne [lat, lon] najbliższego punktu cieku (proponowane miejsce zastawki)")
    nearest_waterway_type: Optional[str] = Field(None, description="Typ najbliższego cieku (ditch, drain, stream, canal, river)")
    has_wetland_or_pond_nearby: Optional[bool] = Field(None, description="Czy w promieniu 500 m wykryto oczko wodne, zbiornik lub mokradło")
    has_windbreak_nearby: Optional[bool] = Field(None, description="Czy w promieniu 300 m wykryto zadrzewienia śródpolne lub żywopłoty")
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
    historical_vulnerability: Optional[ClimateVulnerability10Y] = Field(default=None, description="10-letnia analiza podatności historycznej działki na suszę")
    climatology_10y: Optional[Climatology10y] = Field(default=None, description="Punktowa analiza wieloletnia (ostatnie 10 lat z Open-Meteo Archive)")

class RetentionAction(BaseModel):
    id: str = Field(..., description="Unikalny identyfikator reguły")
    title: str = Field(..., description="Tytuł zalecenia")
    badge: str = Field(..., description="Kategoria i priorytet (np. Retencja krajobrazowa - Priorytet 1)")
    why: str = Field(..., description="Dlaczego zalecamy (uzasadnienie oparte o twarde dane z działki)")
    action: str = Field(..., description="Konkretne działanie agrotechniczne lub inwestycyjne dla rolnika")
    priority: int = Field(..., description="Waga priorytetu (1 = najwyższy)")
    category: str = Field(..., description="Kategoria: landscape | soil | micro_storage")
    water_gain_mm: Optional[float] = Field(None, description="Szacowany zysk retencyjny wody w glebie (mm)")
    drought_buffer_days: Optional[int] = Field(None, description="Liczba dodatkowych dni odporności na brak opadów")
    ecoscheme_name: Optional[str] = Field(None, description="Nazwa ekoschematu lub programu dopłat ARiMR/WPR")
    ecoscheme_code: Optional[str] = Field(None, description="Kod praktyki ekoschematu")
    ecoscheme_pln_per_ha: Optional[int] = Field(None, description="Szacowana stawka dopłaty w PLN/ha")

class IrrigationRecommendation(BaseModel):
    needed: bool = Field(..., description="Czy nawadnianie interwencyjne jest wymagane")
    status: str = Field(..., description="Status zalecenia nawadniania")
    dose_mm: float = Field(..., description="Zalecana dawka interwencyjna wody w mm")
    dose_m3_per_ha: float = Field(..., description="Zalecana dawka w m3 na hektar")
    recommended_timing: str = Field(..., description="Sugerowana pora / okno zabiegu")
    recommended_technique: str = Field(..., description="Rekomendowana technika (kropelkowe, deszczownia niskociśnieniowa)")
    justification: str = Field(..., description="Uzasadnienie dawki w oparciu o AWC i KBW")
    forecast_7d_precip_mm: Optional[float] = Field(None, description="Prognozowana suma opadów w oknie 7-dniowym (mm)")
    weather_window_status: Optional[str] = Field(None, description="Status okna pogodowego: OPTYMALNE | WSTRZYMAJ_OPADY | OSTRZEZENIE_WIATR")

class ReportMetadata(BaseModel):
    sources: List[str] = Field(..., description="Jawny wykaz źródeł danych przestrzennych i meteo")
    analysis_date: str = Field(..., description="Data wygenerowania analizy")
    target_date: Optional[str] = Field(None, description="Data analizowanego stanu pola")
    sentinel_scene_date: Optional[str] = Field(None, description="Data zobrazowania Sentinel-2")
    cloud_cover_percent: Optional[float] = Field(None, description="Stopień zachmurzenia sceny")
    limitations: List[str] = Field(default_factory=list, description="Lista ograniczeń i zastrzeżeń metodycznych")
    execution_time_ms: int = Field(..., description="Czas wykonania obliczeń na backendzie w ms")
    data_freshness: Optional[Dict[str, str]] = Field(default=None, description="Data aktualności i stan każdego źródła danych")
    confidence_level: Optional[str] = Field(default="Wysoka", description="Wskaźnik wiarygodności danych: Wysoka | Średnia | Obniżona")
    confidence_score: Optional[int] = Field(default=95, description="Punktowa ocena wiarygodności (0-100%)")

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
