export type CropType =
  | "pszenica_ozima"
  | "pszenica_jara"
  | "kukurydza"
  | "rzepak"
  | "ziemniak"
  | "burak_cukrowy"
  | "jeczmien"
  | "laki"
  | "warzywa";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface GeoJSONPolygonGeometry {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
}

export interface ParcelFeature {
  type: "Feature";
  properties: {
    teryt: string;
    [key: string]: unknown;
  };
  geometry: GeoJSONPolygonGeometry;
}

export interface ParcelSearchResponse {
  teryt: string;
  voivodeship: string;
  county: string;
  commune: string;
  precinct: string;
  area_ha: number;
  center: [number, number];
  geometry: ParcelFeature;
}

export interface AnalyzeRequest {
  teryt: string;
  crop_type: CropType;
  analysis_date: string;
}

export interface DataSource {
  name: string;
  date: string;
  details: string;
}

export interface AnalysisMetadata {
  parcel_id: string;
  area_ha: number;
  crop: string;
  analysis_date: string;
  processing_time_sec: number;
  data_sources: DataSource[];
  limitations: string[];
}

export interface Step1WaterAssessment {
  drought_risk_level: RiskLevel;
  climatic_water_balance_mm: number;
  precipitation_30d_mm: number;
  evapotranspiration_30d_mm: number;
  ndvi_current: number;
  ndvi_10y_median: number;
  ndmi_current: number;
  ndmi_10y_median: number;
  soil_retention_capacity: RiskLevel;
  slope_percent: number;
  nearby_waterways_count: number;
  identified_causes: string[];
}

export interface RetentionRecommendation {
  category: string;
  title: string;
  justification: string;
}

export interface Step3IrrigationRecommendations {
  is_recommended: boolean;
  recommended_dose_mm: number;
  timing: string;
  justification: string;
}

export interface AnalysisResponse {
  metadata: AnalysisMetadata;
  step_1_water_assessment: Step1WaterAssessment;
  step_2_retention_recommendations: RetentionRecommendation[];
  step_3_irrigation_recommendations: Step3IrrigationRecommendations;
  farmer_friendly_summary: string;
}

export interface ApiErrorResponse {
  detail: string;
}
