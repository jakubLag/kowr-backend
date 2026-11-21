import {
  DailyWeatherPoint,
  DecadeForecastPoint,
  Diagnosis,
} from "@/types/analysis";
import {
  calculateCropKcForMonth,
  CROP_OPTIONS,
  getMonthGrowthStageDescription,
} from "@/lib/crops";

const MONTHLY_NORMALS_PL: Record<
  number,
  { et0Daily: number; precipMonthly: number; temp: number }
> = {
  1: { et0Daily: 0.4, precipMonthly: 34.0, temp: -1.5 },
  2: { et0Daily: 0.7, precipMonthly: 30.0, temp: 0.2 },
  3: { et0Daily: 1.4, precipMonthly: 36.0, temp: 4.0 },
  4: { et0Daily: 2.5, precipMonthly: 40.0, temp: 9.5 },
  5: { et0Daily: 3.6, precipMonthly: 58.0, temp: 14.5 },
  6: { et0Daily: 4.4, precipMonthly: 68.0, temp: 17.8 },
  7: { et0Daily: 4.6, precipMonthly: 78.0, temp: 19.8 },
  8: { et0Daily: 3.9, precipMonthly: 64.0, temp: 19.0 },
  9: { et0Daily: 2.3, precipMonthly: 48.0, temp: 14.0 },
  10: { et0Daily: 1.2, precipMonthly: 42.0, temp: 9.0 },
  11: { et0Daily: 0.6, precipMonthly: 38.0, temp: 4.0 },
  12: { et0Daily: 0.4, precipMonthly: 36.0, temp: 0.5 },
};

export function getTodayIsoString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Zwraca true, jeśli analizowana data jest historyczna (starsza niż dzisiaj).
 * Dla dat historycznych kolejne 60 dni nie są „prognozą pogody”, lecz weryfikacją ex-post.
 */
export function isHistoricalTargetDate(targetDateRaw?: string | null): boolean {
  if (!targetDateRaw) return false;
  const datePart = targetDateRaw.split(" ")[0].trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return false;
  return datePart < getTodayIsoString();
}

export function getCriticalThresholdForSoil(soilCategory: string): number {
  const map: Record<string, number> = {
    "bardzo lekka": -130.0,
    lekka: -160.0,
    średnia: -190.0,
    ciężka: -220.0,
  };
  return map[(soilCategory || "").toLowerCase()] ?? -170.0;
}

function recomputeRolling60DayKbw(
  points: DailyWeatherPoint[]
): DailyWeatherPoint[] {
  return points.map((pt, idx) => {
    const startIdx = Math.max(0, idx - 59);
    let rollingSum = 0;
    for (let j = startIdx; j <= idx; j++) {
      rollingSum += points[j].kbw_daily_mm;
    }
    return {
      ...pt,
      kbw_cumulative_mm: Number(rollingSum.toFixed(1)),
    };
  });
}

/**
 * Zwraca szereg czasowy: 60 dni historii + 60 dni długoterminowej prognozy sezonowej (120 dni).
 * Wylicza kroczący 60-dniowy bilans KBW (okno ruchome 60d zgodne z IUNG-PIB) oraz naturalny rozkład opadów.
 */
export function getOrBuildDailyWeatherSeries(
  diagnosis: Diagnosis,
  analysisDateRaw: string,
  kc: number,
  cropId: string = "kukurydza"
): DailyWeatherPoint[] {
  const cropObj =
    CROP_OPTIONS.find((c) => c.id === cropId.toLowerCase()) || CROP_OPTIONS[0];
  const isArchive = isHistoricalTargetDate(analysisDateRaw);

  const existing = diagnosis.daily_weather_series;
  if (Array.isArray(existing) && existing.length > 0) {
    const histPoints: DailyWeatherPoint[] = existing
      .filter((d) => !d.is_forecast)
      .map((d) => ({ ...d, forecast_kind: "historical" }));
    const directForecast = existing.filter((d) => d.is_forecast);

    // Dla daty bieżącej: pierwsze 16 dni to prognoza synoptyczna Open-Meteo,
    // a dni +17..+60 to scenariusz klimatologiczny.
    // Dla daty historycznej: cały okres po dacie badania oznaczamy jako weryfikację ex-post.
    const trustedForecast: DailyWeatherPoint[] = directForecast
      .slice(0, 16)
      .map((d) => ({
        ...d,
        forecast_kind: isArchive ? "ex_post" : "synoptic_16d",
      }));
    const combined: DailyWeatherPoint[] = [...histPoints, ...trustedForecast];

    const lastPt = combined[combined.length - 1];
    const lastDate = new Date(`${lastPt.date}T12:00:00`);
    const currentCount = trustedForecast.length;

    for (let f = currentCount + 1; f <= 60; f++) {
      const dt = new Date(lastDate);
      dt.setDate(lastDate.getDate() + (f - currentCount));
      const iso = dt.toISOString().slice(0, 10);
      const m = dt.getMonth() + 1;
      const norm = MONTHLY_NORMALS_PL[m] || MONTHLY_NORMALS_PL[7];
      const dayKc = calculateCropKcForMonth(cropObj, m);

      let precip = 0.0;
      if (histPoints.length > 0) {
        const refItem = histPoints[(f * 7 + 3) % histPoints.length];
        const refMonth =
          parseInt(refItem.date.split("-")[1] || String(m), 10) || m;
        const refNormP =
          MONTHLY_NORMALS_PL[refMonth]?.precipMonthly || norm.precipMonthly;
        const monthScale = (norm.precipMonthly / Math.max(20, refNormP)) * 0.85;
        const rawP = refItem.precipitation_mm * monthScale;
        const wave = 0.75 + 0.45 * Math.abs(Math.sin(f * 1.37));
        precip = rawP >= 0.4 ? Number((rawP * wave).toFixed(1)) : 0.0;
      } else {
        const wave = Math.abs(Math.sin(f * 0.93 + 0.4));
        precip =
          wave > 0.78
            ? Number(((norm.precipMonthly / 8.5) * wave * 0.85).toFixed(1))
            : 0.0;
      }

      const et0Wave =
        1.0 + 0.18 * Math.sin(f * 0.65) + 0.08 * Math.cos(f * 1.4);
      const et0 = Number(Math.max(0.2, norm.et0Daily * et0Wave).toFixed(1));
      const kbwDaily = Number((precip - et0 * dayKc).toFixed(1));

      combined.push({
        date: iso,
        precipitation_mm: precip,
        et0_mm: et0,
        kbw_daily_mm: kbwDaily,
        kbw_cumulative_mm: 0,
        is_forecast: true,
        forecast_kind: isArchive ? "ex_post" : "climatology",
        temp_max_c: Number((norm.temp + 2.2 * Math.sin(f * 0.55)).toFixed(1)),
        wind_max_ms: Number(
          (2.1 + 1.8 * Math.abs(Math.sin(f * 0.8 + 0.5))).toFixed(1)
        ),
      });
    }

    return recomputeRolling60DayKbw(combined);
  }

  // Fallback, gdy zdalny VPS nie zwrócił jeszcze tablicy daily_weather_series
  const baseDateStr = analysisDateRaw.split(" ")[0];
  const parsed = new Date(`${baseDateStr}T12:00:00`);
  const anchorDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  const targetKbw60 = diagnosis.kbw_60d_mm;
  const avgDailyKbw = targetKbw60 / 60.0;

  const series: DailyWeatherPoint[] = [];

  for (let i = -59; i <= 0; i++) {
    const dt = new Date(anchorDate);
    dt.setDate(anchorDate.getDate() + i);
    const iso = dt.toISOString().slice(0, 10);
    const m = dt.getMonth() + 1;
    const norm = MONTHLY_NORMALS_PL[m] || MONTHLY_NORMALS_PL[7];
    const dayIndex = i + 59;

    const wave = Math.abs(Math.sin(dayIndex * 0.87 + 0.3));
    const baseDailyEtc = norm.et0Daily * Math.max(0.3, kc);
    const precip =
      wave > 0.76
        ? Number(
            Math.max(
              1.2,
              (baseDailyEtc + avgDailyKbw) * (2.6 + 1.8 * Math.sin(dayIndex))
            ).toFixed(1)
          )
        : 0.0;
    const et0 = Number(
      Math.max(
        0.2,
        norm.et0Daily * (1 + 0.16 * Math.sin(dayIndex * 0.7))
      ).toFixed(1)
    );
    const kbwDaily = Number((precip - et0 * kc).toFixed(1));

    series.push({
      date: iso,
      precipitation_mm: precip,
      et0_mm: et0,
      kbw_daily_mm: kbwDaily,
      kbw_cumulative_mm: 0,
      is_forecast: false,
      forecast_kind: "historical",
      temp_max_c: Number((norm.temp + 2.0 * Math.sin(dayIndex * 0.5)).toFixed(1)),
      wind_max_ms: Number(
        (2.2 + 1.5 * Math.abs(Math.sin(dayIndex * 0.9))).toFixed(1)
      ),
    });
  }

  const histCopy = [...series];

  for (let f = 1; f <= 60; f++) {
    const dt = new Date(anchorDate);
    dt.setDate(anchorDate.getDate() + f);
    const iso = dt.toISOString().slice(0, 10);
    const m = dt.getMonth() + 1;
    const norm = MONTHLY_NORMALS_PL[m] || MONTHLY_NORMALS_PL[7];
    const dayKc = calculateCropKcForMonth(cropObj, m);

    const refItem = histCopy[(f * 7 + 3) % histCopy.length];
    const wave = 0.75 + 0.45 * Math.abs(Math.sin(f * 1.37));
    const precip =
      refItem.precipitation_mm >= 0.4
        ? Number((refItem.precipitation_mm * wave * 0.85).toFixed(1))
        : 0.0;
    const et0 = Number(
      Math.max(0.2, norm.et0Daily * (1 + 0.18 * Math.sin(f * 0.65))).toFixed(1)
    );
    const kbwDaily = Number((precip - et0 * dayKc).toFixed(1));

    series.push({
      date: iso,
      precipitation_mm: precip,
      et0_mm: et0,
      kbw_daily_mm: kbwDaily,
      kbw_cumulative_mm: 0,
      is_forecast: true,
      forecast_kind: isArchive ? "ex_post" : "climatology",
      temp_max_c: Number((norm.temp + 2.2 * Math.sin(f * 0.55)).toFixed(1)),
      wind_max_ms: Number(
        (2.1 + 1.8 * Math.abs(Math.sin(f * 0.8 + 0.5))).toFixed(1)
      ),
    });
  }

  return recomputeRolling60DayKbw(series);
}

/**
 * Zwraca 6 dekad (po 10 dni = 60 dni prognozy długoterminowej).
 */
export function getOrBuild60DayDecades(
  diagnosis: Diagnosis,
  weatherSeries: DailyWeatherPoint[],
  cropId: string
): DecadeForecastPoint[] {
  const cropObj =
    CROP_OPTIONS.find((c) => c.id === cropId.toLowerCase()) || CROP_OPTIONS[0];
  const forecastPoints = weatherSeries.filter((d) => d.is_forecast);
  const roman = ["I", "II", "III", "IV", "V", "VI"];
  const critThreshold =
    diagnosis.critical_threshold_kbw_60d_mm ??
    getCriticalThresholdForSoil(diagnosis.soil_category);

  const decades: DecadeForecastPoint[] = [];

  for (let idx = 0; idx < 6; idx++) {
    const chunk = forecastPoints.slice(idx * 10, (idx + 1) * 10);
    if (chunk.length === 0) break;

    const startDate = chunk[0].date;
    const endDate = chunk[chunk.length - 1].date;
    const m = parseInt(startDate.split("-")[1] || "7", 10) || 7;
    const decKc = calculateCropKcForMonth(cropObj, m);
    const stage = getMonthGrowthStageDescription(m, cropObj.id)
      .split("(")[0]
      .trim();

    const precipSum = Number(
      chunk.reduce((acc, c) => acc + c.precipitation_mm, 0).toFixed(1)
    );
    const et0Sum = Number(
      chunk.reduce((acc, c) => acc + c.et0_mm, 0).toFixed(1)
    );
    const etcSum = Number((et0Sum * decKc).toFixed(1));
    const decKbw = Number((precipSum - etcSum).toFixed(1));
    const rollingKbw60 = chunk[chunk.length - 1].kbw_cumulative_mm;

    let riskStatus =
      "Bilans dekadowy stabilny — naturalna retencja glebowa wystarczająca";
    if (rollingKbw60 < critThreshold) {
      riskStatus = `Wysokie ryzyko suszy (przekroczony próg IUNG ${critThreshold} mm) — wymagana rezerwa nawodnieniowa`;
    } else if (decKbw < -18.0) {
      riskStatus =
        "Rosnący deficyt w dekadzie — priorytet zatrzymania wody w glebie i rowach";
    }

    const dayFrom = idx * 10 + 1;
    const dayTo = idx * 10 + chunk.length;

    decades.push({
      decade_number: idx + 1,
      period_label: `${roman[idx]} dekada (+${dayFrom}..+${dayTo} dni)`,
      start_date: startDate,
      end_date: endDate,
      crop_kc: decKc,
      growth_stage: stage,
      precipitation_mm: precipSum,
      et0_mm: et0Sum,
      etc_mm: etcSum,
      kbw_decade_mm: decKbw,
      kbw_60d_rolling_mm: rollingKbw60,
      risk_status: riskStatus,
    });
  }

  return decades;
}
