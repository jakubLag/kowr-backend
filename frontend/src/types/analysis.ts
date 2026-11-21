export type CropType =
  | "kukurydza"
  | "pszenica_ozima"
  | "pszenica_jara"
  | "rzepak"
  | "burak_cukrowy"
  | "ziemniak"
  | "jeczmien"
  | "zyto"
  | "soja"
  | "laka";

export interface CropInfo {
  id: CropType | string;
  name_pl: string;
  kc_initial: number;
  kc_mid: number;
  kc_end: number;
  root_depth_m: number;
  drought_sensitivity: string;
}

export interface PointCoordinates {
  lat: number;
  lon: number;
}

export interface ParcelGeometry {
  type: "Polygon" | "MultiPolygon" | string;
  coordinates: number[][][] | number[][][][];
}

export interface ParcelSearchResponse {
  teryt: string;
  voivodeship?: string | null;
  county?: string | null;
  commune?: string | null;
  precinct?: string | null;
  parcel_number?: string | null;
  area_ha: number;
  center: PointCoordinates;
  geometry: ParcelGeometry;
  wkt_2180?: string | null;
}

export interface AnalyzeRequest {
  teryt: string;
  crop: CropType | string;
  target_date?: string | null;
}

export interface DailyWeatherPoint {
  date: string;
  precipitation_mm: number;
  et0_mm: number;
  kbw_daily_mm: number;
  kbw_cumulative_mm: number;
  is_forecast: boolean;
  forecast_kind?: "historical" | "synoptic_16d" | "climatology" | "ex_post";
  temp_max_c?: number | null;
  wind_max_ms?: number | null;
}

export interface DecadeForecastPoint {
  decade_number: number;
  period_label: string;
  start_date: string;
  end_date: string;
  crop_kc: number;
  growth_stage: string;
  precipitation_mm: number;
  et0_mm: number;
  etc_mm: number;
  kbw_decade_mm: number;
  kbw_60d_rolling_mm: number;
  risk_status: string;
}

export interface Climatology10yYearPoint {
  year: number;
  season_kbw_mm: number;
  drought_occurred: boolean;
}

export interface Climatology10y {
  drought_years_count: number;
  total_years_analyzed: number;
  historical_vulnerability_level: "WYSOKA" | "UMIARKOWANA" | "NISKA" | string;
  peak_risk_months: string[];
  max_dry_spell_days_30d?: number | null;
  avg_max_dry_spell_10y?: number | null;
  kbw_60d_10y_median_mm?: number | null;
  yearly_series?: Climatology10yYearPoint[] | null;
}

export interface DataSourceMeta {
  name: string;
  category?: string | null;
  fetched_mode: "live" | "cached" | "static" | "unavailable" | string;
  data_freshness: string;
  spatial_resolution?: string | null;
  license?: string | null;
}

export interface Diagnosis {
  kbw_30d_mm: number;
  kbw_60d_mm: number;
  kbw_status: string;
  drought_risk_level: "WYSOKIE" | "UMIARKOWANE" | "NISKIE" | string;
  awc_mm: number;
  awc_root_zone_mm?: number | null;
  soil_category: string;
  soil_texture: string;
  ndvi_current?: number | null;
  ndvi_historical_median?: number | null;
  ndvi_anomaly_percent?: number | null;
  ndmi_current?: number | null;
  slope_percent: number | null;
  aspect_direction?: string | null;
  distance_to_ditch_m?: number | null;
  nearest_waterway_coords?: [number, number][] | null;
  nearest_waterway_type?: string | null;
  nearest_waterway_point?: [number, number] | null;
  has_wetland_or_pond_nearby?: boolean | null;
  has_windbreak_nearby?: boolean | null;
  climatology_10y?: Climatology10y | null;
  primary_causes: string[];
  precipitation_30d_mm?: number | null;
  et0_30d_mm?: number | null;
  forecast_7d_precip_mm?: number | null;
  forecast_7d_et0_mm?: number | null;
  forecast_60d_precip_mm?: number | null;
  forecast_60d_et0_mm?: number | null;
  forecast_60d_kbw_mm?: number | null;
  critical_threshold_kbw_60d_mm?: number | null;
  daily_weather_series?: DailyWeatherPoint[] | null;
  forecast_60d_decades?: DecadeForecastPoint[] | null;
}

export interface RetentionAction {
  id: string;
  title: string;
  badge: string;
  why: string;
  action: string;
  priority: number;
  category: string;
  water_gain_mm?: number | null;
  drought_buffer_days?: number | null;
  ecoscheme_name?: string | null;
  ecoscheme_code?: string | null;
  ecoscheme_pln_per_ha?: number | null;
}

export interface IrrigationRecommendation {
  needed: boolean;
  status: string;
  dose_mm: number;
  dose_m3_per_ha: number;
  recommended_timing: string;
  recommended_technique: string;
  justification: string;
  forecast_7d_precip_mm?: number | null;
  weather_window_status?: string | null;
}

export interface ReportMetadata {
  sources: string[];
  analysis_date: string;
  target_date?: string | null;
  generated_at?: string | null;
  data_sources?: DataSourceMeta[] | null;
  confidence_level?: "WYSOKA" | "ŚREDNIA" | "OBNIŻONA" | string | null;
  confidence_score_percent?: number | null;
  confidence_explanation?: string | null;
  sentinel_scene_date?: string | null;
  cloud_cover_percent?: number | null;
  limitations: string[];
  execution_time_ms: number;
}

export interface ParcelLastAnalysis {
  riskLevel: string;
  kbw30dMm: number;
  crop: string;
  cropLabel: string;
  targetDate: string;
  analyzedAt: string;
}

export interface StoredRecentParcel extends ParcelSearchResponse {
  lastAnalysis?: ParcelLastAnalysis;
}

export interface AnalysisResponse {
  teryt: string;
  crop: string;
  kc_coefficient: number;
  parcel_info: ParcelSearchResponse;
  step1_diagnosis: Diagnosis;
  step2_retention: RetentionAction[];
  step3_irrigation: IrrigationRecommendation;
  metadata: ReportMetadata;
}

export interface ApiErrorResponse {
  detail: string;
}

export interface LocationSuggestion {
  id: string;
  name: string;
  details: string;
  lat: number;
  lon: number;
}

export interface LandUseCheckResult {
  status: "water" | "forest" | "agricultural";
  label: string;
  featureName?: string | null;
  canAnalyze: boolean;
}
