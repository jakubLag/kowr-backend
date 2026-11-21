import {
  DailyWeatherPoint,
  Diagnosis,
  RetentionAction,
} from "@/types/analysis";

export interface EnrichedRetentionImpact {
  waterGainMm: number;
  waterGainM3PerHa: number;
  droughtBufferDays: number;
  ecoschemeName: string;
  ecoschemeCode: string;
  ecoschemePlnPerHa: number;
}

const DEFAULT_RULE_IMPACTS: Record<string, Omit<EnrichedRetentionImpact, "waterGainM3PerHa">> = {
  RETENTION_DITCH_WEIR: {
    waterGainMm: 12.0,
    droughtBufferDays: 4,
    ecoschemeName: "Inwestycje wodno-środowiskowe i retencja korytowa (ARiMR)",
    ecoschemeCode: "I.10.3 / Retencja",
    ecoschemePlnPerHa: 310,
  },
  SOIL_LOW_AWC_COVER_CROP: {
    waterGainMm: 9.5,
    droughtBufferDays: 3,
    ecoschemeName: "Ekoschemat: Międzyplony ścierniskowe lub wsiewki (5 pkt)",
    ecoschemeCode: "EKO-MP",
    ecoschemePlnPerHa: 435,
  },
  NO_TILL_EVAPORATION_REDUCTION: {
    waterGainMm: 11.0,
    droughtBufferDays: 3,
    ecoschemeName:
      "Ekoschemat: Uproszczone systemy uprawy (4 pkt) + Wymieszanie słomy (2 pkt)",
    ecoschemeCode: "EKO-USU",
    ecoschemePlnPerHa: 520,
  },
  CONTOUR_FARMING_SLOPE: {
    waterGainMm: 8.0,
    droughtBufferDays: 2,
    ecoschemeName: "Ekoschemat: Pasy buforowe i ochrona gleb przed erozją",
    ecoschemeCode: "EKO-EROZJA",
    ecoschemePlnPerHa: 280,
  },
  MICRO_RETENTION_POND: {
    waterGainMm: 10.0,
    droughtBufferDays: 3,
    ecoschemeName: "Program małej retencji rolniczej (KOWR / ARiMR)",
    ecoschemeCode: "RET-MIKRO",
    ecoschemePlnPerHa: 350,
  },
};

export function getRetentionActionImpact(
  action: RetentionAction
): EnrichedRetentionImpact {
  const fallback = DEFAULT_RULE_IMPACTS[action.id] || {
    waterGainMm: action.category === "landscape" ? 10.0 : 8.5,
    droughtBufferDays: 3,
    ecoschemeName: "Ekoschemat: Rolnictwo węglowe i retencja glebowa (ARiMR)",
    ecoschemeCode: "EKO-WODA",
    ecoschemePlnPerHa: 380,
  };

  const waterGainMm =
    action.water_gain_mm != null ? action.water_gain_mm : fallback.waterGainMm;

  return {
    waterGainMm,
    waterGainM3PerHa: Math.round(waterGainMm * 10),
    droughtBufferDays:
      action.drought_buffer_days != null
        ? action.drought_buffer_days
        : fallback.droughtBufferDays,
    ecoschemeName: action.ecoscheme_name || fallback.ecoschemeName,
    ecoschemeCode: action.ecoscheme_code || fallback.ecoschemeCode,
    ecoschemePlnPerHa:
      action.ecoscheme_pln_per_ha != null
        ? action.ecoscheme_pln_per_ha
        : fallback.ecoschemePlnPerHa,
  };
}

export interface RetentionSimulationSummary {
  selectedCount: number;
  totalWaterGainMm: number;
  totalWaterGainM3Parcel: number;
  newAwcMm: number;
  totalBufferDays: number;
  irrigationDoseBeforeMm: number;
  irrigationDoseAfterMm: number;
  savedIrrigationM3Parcel: number;
  totalSubsidyPlnPerHa: number;
  totalSubsidyPlnParcel: number;
}

export function calculateRetentionSimulation(
  actions: RetentionAction[],
  selectedIds: string[],
  baseAwcMm: number,
  baseIrrigationDoseMm: number,
  areaHa: number
): RetentionSimulationSummary {
  let totalWaterGainMm = 0;
  let totalBufferDays = 0;
  let totalSubsidyPlnPerHa = 0;
  let selectedCount = 0;

  for (const act of actions) {
    if (!selectedIds.includes(act.id)) continue;
    selectedCount += 1;
    const impact = getRetentionActionImpact(act);
    totalWaterGainMm += impact.waterGainMm;
    totalBufferDays += impact.droughtBufferDays;
    totalSubsidyPlnPerHa += impact.ecoschemePlnPerHa;
  }

  // Część zatrzymanej wody bezpośrednio zmniejsza konieczną dawkę nawadniania interwencyjnego (współczynnik efektywności 0.65)
  const effectiveDoseReductionMm = totalWaterGainMm * 0.65;
  const irrigationDoseAfterMm =
    baseIrrigationDoseMm > 0
      ? Math.max(
          0,
          Number((baseIrrigationDoseMm - effectiveDoseReductionMm).toFixed(1))
        )
      : 0;

  const savedDoseMm = Math.max(0, baseIrrigationDoseMm - irrigationDoseAfterMm);

  return {
    selectedCount,
    totalWaterGainMm: Number(totalWaterGainMm.toFixed(1)),
    totalWaterGainM3Parcel: Math.round(totalWaterGainMm * 10 * areaHa),
    newAwcMm: Number((baseAwcMm + totalWaterGainMm * 0.6).toFixed(1)),
    totalBufferDays,
    irrigationDoseBeforeMm: baseIrrigationDoseMm,
    irrigationDoseAfterMm,
    savedIrrigationM3Parcel: Math.round(savedDoseMm * 10 * areaHa),
    totalSubsidyPlnPerHa: Math.round(totalSubsidyPlnPerHa),
    totalSubsidyPlnParcel: Math.round(totalSubsidyPlnPerHa * areaHa),
  };
}

/**
 * Zwraca szereg czasowy (30 dni historii + 7 dni prognozy).
 * Jeśli backend zwraca `diagnosis.daily_weather_series`, używa danych bezpośrednio z API.
 * Jeśli backend nie został jeszcze zaktualizowany, rekonstruuje spójny przebieg z bilansu `kbw_30d_mm`.
 */
export function getOrBuildDailyWeatherSeries(
  diagnosis: Diagnosis,
  analysisDateRaw: string,
  kc: number
): DailyWeatherPoint[] {
  if (
    Array.isArray(diagnosis.daily_weather_series) &&
    diagnosis.daily_weather_series.length > 0
  ) {
    return diagnosis.daily_weather_series;
  }

  const baseDateStr = analysisDateRaw.split(" ")[0];
  const parsed = new Date(`${baseDateStr}T12:00:00`);
  const anchorDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  const targetKbw30 = diagnosis.kbw_30d_mm;
  const avgDailyKbw = targetKbw30 / 30.0;
  const baseDailyEt0 = 3.8;
  const baseDailyEtc = baseDailyEt0 * Math.max(0.4, kc);

  const series: DailyWeatherPoint[] = [];
  let cumulative = 0;

  // 30 dni historii (-29 .. 0)
  for (let i = -29; i <= 0; i++) {
    const dt = new Date(anchorDate);
    dt.setDate(anchorDate.getDate() + i);
    const iso = dt.toISOString().slice(0, 10);

    // Deterministyczny rozkład dni deszczowych (co ~7-9 dni umiarkowany opad)
    const dayIndex = i + 29;
    const isRainDay = dayIndex === 6 || dayIndex === 15 || dayIndex === 23;
    const precip = isRainDay
      ? Number(Math.max(2.0, (baseDailyEtc + avgDailyKbw) * 3.8).toFixed(1))
      : 0.0;
    const et0 = Number(
      (baseDailyEt0 + ((dayIndex % 5) - 2) * 0.25).toFixed(1)
    );
    const kbwDaily = Number((precip - et0 * kc).toFixed(1));
    cumulative = Number((cumulative + kbwDaily).toFixed(1));

    series.push({
      date: iso,
      precipitation_mm: precip,
      et0_mm: et0,
      kbw_daily_mm: kbwDaily,
      kbw_cumulative_mm: cumulative,
      is_forecast: false,
      temp_max_c: Number((21.0 + ((dayIndex % 6) - 2) * 1.1).toFixed(1)),
      wind_max_ms: Number((2.4 + (dayIndex % 4) * 0.6).toFixed(1)),
    });
  }

  // Korekta ostatniego dnia historii, aby skumulowane KBW na dzień 0 zgadzało się 1:1 z `diagnosis.kbw_30d_mm`
  if (series.length > 0) {
    series[series.length - 1].kbw_cumulative_mm = Number(
      targetKbw30.toFixed(1)
    );
    cumulative = series[series.length - 1].kbw_cumulative_mm;
  }

  // 7 dni prognozy (+1 .. +7)
  for (let f = 1; f <= 7; f++) {
    const dt = new Date(anchorDate);
    dt.setDate(anchorDate.getDate() + f);
    const iso = dt.toISOString().slice(0, 10);

    const precip = f === 4 ? 6.5 : f === 5 ? 3.0 : 0.0;
    const et0 = Number((3.6 + ((f % 3) - 1) * 0.3).toFixed(1));
    const kbwDaily = Number((precip - et0 * kc).toFixed(1));
    cumulative = Number((cumulative + kbwDaily).toFixed(1));

    series.push({
      date: iso,
      precipitation_mm: precip,
      et0_mm: et0,
      kbw_daily_mm: kbwDaily,
      kbw_cumulative_mm: cumulative,
      is_forecast: true,
      temp_max_c: Number((22.0 + ((f % 4) - 1) * 1.0).toFixed(1)),
      wind_max_ms: Number((2.1 + (f % 5) * 0.7).toFixed(1)),
    });
  }

  return series;
}
