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
  temp_max_c?: number | null;
  wind_max_ms?: number | null;
}

export interface Diagnosis {
  kbw_30d_mm: number;
  kbw_60d_mm: number;
  kbw_status: string;
  drought_risk_level: "WYSOKIE" | "UMIARKOWANE" | "NISKIE" | string;
  awc_mm: number;
  soil_category: string;
  soil_texture: string;
  ndvi_current?: number | null;
  ndvi_historical_median?: number | null;
  ndvi_anomaly_percent?: number | null;
  ndmi_current?: number | null;
  slope_percent: number;
  distance_to_ditch_m?: number | null;
  primary_causes: string[];
  precipitation_30d_mm?: number | null;
  et0_30d_mm?: number | null;
  forecast_7d_precip_mm?: number | null;
  forecast_7d_et0_mm?: number | null;
  daily_weather_series?: DailyWeatherPoint[] | null;
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
  sentinel_scene_date?: string | null;
  cloud_cover_percent?: number | null;
  limitations: string[];
  execution_time_ms: number;
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
