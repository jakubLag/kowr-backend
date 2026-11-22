import {
  DailyWeatherPoint,
  Diagnosis,
  IrrigationRecommendation,
  ReportMetadata,
  RetentionAction,
} from "@/types/analysis";

export interface RetentionFallbackMeta {
  water_gain_mm: number;
  drought_buffer_days: number;
  ecoscheme_name: string;
  ecoscheme_code?: string;
  ecoscheme_pln_per_ha?: number;
}

export const RETENTION_ENRICHMENT_BY_ID: Record<string, RetentionFallbackMeta> = {
  RETENTION_DITCH_WEIR: {
    water_gain_mm: 25,
    drought_buffer_days: 7,
    ecoscheme_name:
      "Ekoschemat: Retencjonowanie wody na trwałych użytkach zielonych / Inwestycje w małą retencję (PS WPR 2023–2027)",
    ecoscheme_code: "E_RET / I.10.4",
    ecoscheme_pln_per_ha: 260,
  },
  DRAINAGE_DITCH_OPEN_WEIR: {
    water_gain_mm: 20,
    drought_buffer_days: 5,
    ecoscheme_name:
      "Dwukierunkowa regulacja melioracji — wsparcie spółek wodnych i inwestycji retencyjnych (PS WPR)",
    ecoscheme_code: "I.10.4",
  },
  SOIL_WATERLOGGING_SUBSOILING: {
    water_gain_mm: 15,
    drought_buffer_days: 4,
    ecoscheme_name:
      "Ekoschemat: Rolnictwo węglowe — Uproszczone systemy uprawy (ochrona struktury gleby)",
    ecoscheme_code: "E_USU",
    ecoscheme_pln_per_ha: 250,
  },
  SOIL_LOW_AWC_COVER_CROP: {
    water_gain_mm: 22,
    drought_buffer_days: 6,
    ecoscheme_name:
      "Ekoschemat: Rolnictwo węglowe — Międzyplony ozime lub wsiewki śródplonowe",
    ecoscheme_code: "E_MPW",
    ecoscheme_pln_per_ha: 435,
  },
  NO_TILL_EVAPORATION_REDUCTION: {
    water_gain_mm: 18,
    drought_buffer_days: 5,
    ecoscheme_name:
      "Ekoschemat: Rolnictwo węglowe — Uproszczone systemy uprawy / Wymieszanie słomy z glebą",
    ecoscheme_code: "E_USU / E_WSG",
    ecoscheme_pln_per_ha: 250,
  },
  CONTOUR_FARMING_SLOPE: {
    water_gain_mm: 20,
    drought_buffer_days: 5,
    ecoscheme_name:
      "Norma GAEC 5 (zarządzanie uprawą ograniczające erozję) + Ekoschemat: Uproszczone systemy uprawy",
    ecoscheme_code: "GAEC 5 / E_USU",
    ecoscheme_pln_per_ha: 250,
  },
  MICRO_RETENTION_POND: {
    water_gain_mm: 35,
    drought_buffer_days: 10,
    ecoscheme_name:
      "Programy małej retencji rolniczej (ARiMR / WFOŚiGW — budowa oczek wodnych i zbiorników retencyjnych)",
    ecoscheme_code: "PS WPR / NFOŚiGW",
  },
  WETLAND_POND_PROTECTION: {
    water_gain_mm: 25,
    drought_buffer_days: 7,
    ecoscheme_name:
      "Norma GAEC 2 / GAEC 8 (ochrona torfowisk, mokradeł i oczek wodnych) + Ekoschemat: Obszary z roślinami miododajnymi / strefy buforowe",
    ecoscheme_code: "GAEC 2 / GAEC 8",
  },
  WINDBREAK_SHELTERBELT: {
    water_gain_mm: 18,
    drought_buffer_days: 5,
    ecoscheme_name:
      "Interwencja PS WPR: Zakładanie zadrzewień śródpolnych i systemów rolno-leśnych (ARiMR)",
    ecoscheme_code: "I.10.10 / I.10.11",
    ecoscheme_pln_per_ha: 1100,
  },
};

export function checkIsWaterlogged(diagnosis?: Diagnosis | null): boolean {
  if (!diagnosis) return false;
  return (
    diagnosis.drought_risk_level.toUpperCase().includes("NADMIAR") ||
    diagnosis.kbw_30d_mm > Math.max(35, diagnosis.awc_mm * 0.85) ||
    diagnosis.kbw_60d_mm > Math.max(60, diagnosis.awc_mm * 1.4)
  );
}

export function getEffectivePrimaryCauses(diagnosis: Diagnosis): string[] {
  const isWaterlogged = checkIsWaterlogged(diagnosis);
  const sanitized = diagnosis.primary_causes.filter(
    (c) => !c.toLowerCase().includes("rowy nie wpływają na nawodnienie")
  );

  if (
    isWaterlogged &&
    !sanitized.some((c) => c.toLowerCase().includes("nadwyżka"))
  ) {
    return [
      `Nadwyżka opadów nad parowaniem (KBW 30d: +${diagnosis.kbw_30d_mm.toFixed(1)} mm, KBW 60d: +${diagnosis.kbw_60d_mm.toFixed(1)} mm) przekracza pojemność wodną warstwy ornej (AWC: ${diagnosis.awc_mm.toFixed(1)} mm) — ryzyko zastoisk wodnych i niedotlenienia strefy korzeniowej.`,
      ...sanitized.filter(
        (c) => !c.toLowerCase().includes("w granicach normy")
      ),
    ];
  }

  return sanitized.length > 0
    ? sanitized
    : ["Warunki wodne i wilgotnościowe w granicach normy."];
}

export function adaptRetentionRecommendations(
  recommendations: RetentionAction[],
  diagnosis?: Diagnosis | null
): RetentionAction[] {
  const isWaterlogged = checkIsWaterlogged(diagnosis);
  if (!isWaterlogged || !diagnosis) return recommendations;

  if (
    recommendations.some(
      (r) =>
        r.id === "DRAINAGE_DITCH_OPEN_WEIR" ||
        r.id === "SOIL_WATERLOGGING_SUBSOILING"
    )
  ) {
    return recommendations;
  }

  const list: RetentionAction[] = [];
  if (
    diagnosis.distance_to_ditch_m != null &&
    diagnosis.distance_to_ditch_m <= 300
  ) {
    list.push({
      id: "DRAINAGE_DITCH_OPEN_WEIR",
      title:
        "Regulacja odpływu na rowie melioracyjnym (odprowadzenie nadmiaru wody zastoiskowej)",
      badge: "Melioracja dwukierunkowa (Priorytet 1)",
      why: `Na działce występuje znaczna nadwyżka wody (KBW 30d: +${diagnosis.kbw_30d_mm.toFixed(1)} mm) przekraczająca pojemność gleby (AWC: ${diagnosis.awc_mm.toFixed(1)} mm), a w odległości ${Math.round(diagnosis.distance_to_ditch_m)} m znajduje się rów melioracyjny.`,
      action:
        "Otwórz zastawkę piętrzącą i udrożnij przepusty na rowie melioracyjnym do czasu zejścia wody zastoiskowej, a po ustabilizowaniu wilgotności ponownie zamknij zastawkę, aby zachować rezerwę na okres wiosenno-letni.",
      priority: 1,
      category: "landscape",
    });
  }

  list.push({
    id: "SOIL_WATERLOGGING_SUBSOILING",
    title:
      "Głęboszowanie przełamujące podeszwę płużną i ochrona mokrej gleby przed ugniataniem",
    badge: "Napowietrzenie profilu glebowego (Priorytet 1)",
    why: `Nadmiar opadów (+${diagnosis.kbw_30d_mm.toFixed(1)} mm) wypełnił pory powietrzne w warstwie ornej (AWC: ${diagnosis.awc_mm.toFixed(1)} mm), co grozi niedotlenieniem i gniciem korzeni.`,
    action:
      "Wstrzymaj wjazd ciężkim sprzętem na przelaną glebę (aby nie zniszczyć jej struktury), a po obeschnięciu wykonaj głęboszowanie (35–45 cm) ułatwiające przesiąkanie nadmiaru wody do głębszych warstw.",
    priority: 1,
    category: "soil",
  });

  for (const rec of recommendations) {
    if (rec.id !== "RETENTION_DITCH_WEIR") {
      list.push(rec);
    }
  }
  return list;
}

export interface WeatherWindowInfo {
  tone: "warning" | "success" | "info";
  text: string;
  forecast7dPrecipMm: number | null;
  maxWind7dMs: number | null;
}

export function computeWeatherWindowSummary(
  irrigation: IrrigationRecommendation,
  diagnosis?: Diagnosis | null,
  weatherSeries: DailyWeatherPoint[] = [],
  isArchive: boolean = false
): WeatherWindowInfo {
  const next7ForecastPoints = weatherSeries
    .filter((p) => p.is_forecast)
    .slice(0, 7);

  const forecast7dPrecipMm =
    irrigation.forecast_7d_precip_mm ??
    diagnosis?.forecast_7d_precip_mm ??
    (next7ForecastPoints.length > 0
      ? Number(
          next7ForecastPoints
            .reduce((acc, p) => acc + p.precipitation_mm, 0)
            .toFixed(1)
        )
      : null);

  const maxWind7dMs =
    next7ForecastPoints.length > 0
      ? next7ForecastPoints.reduce<number | null>((max, p) => {
          if (p.wind_max_ms == null) return max;
          return max == null ? p.wind_max_ms : Math.max(max, p.wind_max_ms);
        }, null)
      : null;

  if (irrigation.weather_window_status) {
    return {
      tone:
        forecast7dPrecipMm != null && forecast7dPrecipMm >= 15
          ? "warning"
          : "info",
      text: irrigation.weather_window_status,
      forecast7dPrecipMm,
      maxWind7dMs,
    };
  }
  if (isArchive) {
    return {
      tone: "info",
      text:
        forecast7dPrecipMm != null
          ? `Analiza historyczna — w kolejnych 7 dniach po badanej dacie zanotowano ${forecast7dPrecipMm.toFixed(1)} mm opadu (informacja ex-post, nie wpływa na decyzję z dnia badania).`
          : "Analiza historyczna — okno prognostyczne nie jest stosowane wstecz.",
      forecast7dPrecipMm,
      maxWind7dMs,
    };
  }
  if (forecast7dPrecipMm != null && forecast7dPrecipMm >= 15) {
    return {
      tone: "warning",
      text: `Prognozowany istotny opad ${forecast7dPrecipMm.toFixed(1)} mm w ciągu 7 dni — zalecane wstrzymanie lub obniżenie dawki nawadniania w oczekiwaniu na deszcz.${maxWind7dMs != null && maxWind7dMs > 5 ? ` Dodatkowo prognozowany wiatr do ${maxWind7dMs.toFixed(1)} m/s.` : ""}`,
      forecast7dPrecipMm,
      maxWind7dMs,
    };
  }
  if (maxWind7dMs != null && maxWind7dMs > 5.0) {
    return {
      tone: "warning",
      text: `Prognozowany opad 7-dniowy: ${forecast7dPrecipMm != null ? `${forecast7dPrecipMm.toFixed(1)} mm` : "brak danych"}, ale wiatr do ${maxWind7dMs.toFixed(1)} m/s — wysokie straty parowania przy deszczowni; zalecany zabieg nocny lub nawadnianie kroplowe.`,
      forecast7dPrecipMm,
      maxWind7dMs,
    };
  }
  return {
    tone: "success",
    text: `Prognozowany opad 7-dniowy: ${forecast7dPrecipMm != null ? `${forecast7dPrecipMm.toFixed(1)} mm` : "brak danych"}${maxWind7dMs != null ? `, wiatr maks. ${maxWind7dMs.toFixed(1)} m/s` : ""} — korzystne okno pogodowe (zabieg najlepiej wykonać w godzinach nocnych lub wczesnoporannych).`,
    forecast7dPrecipMm,
    maxWind7dMs,
  };
}

export interface AnalysisConfidenceInfo {
  level: string;
  score: number;
  explanation: string;
}

export function computeAnalysisConfidence(
  metadata: ReportMetadata,
  diagnosis?: Diagnosis | null
): AnalysisConfidenceInfo {
  if (metadata.confidence_level && metadata.confidence_score_percent != null) {
    return {
      level: metadata.confidence_level,
      score: metadata.confidence_score_percent,
      explanation:
        metadata.confidence_explanation ||
        "Poziom pewności wyznaczony na podstawie kompletności źródeł danych.",
    };
  }

  let score = 100;
  const reasons: string[] = [];

  if (
    !metadata.sentinel_scene_date ||
    (diagnosis && diagnosis.ndvi_current == null)
  ) {
    score -= 25;
    reasons.push("brak aktualnej bezchmurnej sceny Sentinel-2");
  } else if (
    metadata.cloud_cover_percent != null &&
    metadata.cloud_cover_percent > 15
  ) {
    score -= 10;
    reasons.push(
      `podwyższone zachmurzenie sceny satelitarnej (${metadata.cloud_cover_percent.toFixed(1)}%)`
    );
  }

  if (diagnosis && diagnosis.distance_to_ditch_m == null) {
    score -= 10;
    reasons.push("brak wykrytych cieków/rowów w buforze 500 m (OSM)");
  }

  const hasApiFallbackWarning = (metadata.limitations || []).some((l) =>
    /fallback|niedostępn|błąd|awari|timeout|przybliżon|zastępcz/i.test(l)
  );
  if (hasApiFallbackWarning) {
    score -= 20;
    reasons.push(
      "część parametrów pochodzi z danych zastępczych/szacunkowych"
    );
  }

  score = Math.max(30, Math.min(100, score));
  const level = score >= 80 ? "WYSOKA" : score >= 55 ? "ŚREDNIA" : "OBNIŻONA";
  const explanation =
    reasons.length === 0
      ? "Wszystkie kluczowe źródła danych (meteorologia, gleba, satelita Sentinel-2, ewidencja działki) zostały pobrane poprawnie dla wybranej daty."
      : `Pewność obniżona ze względu na: ${reasons.join("; ")}.`;

  return { level, score, explanation };
}
