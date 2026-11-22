"use client";

import React from "react";
import {
  AnalysisResponse,
  DailyWeatherPoint,
} from "@/types/analysis";
import {
  adaptRetentionRecommendations,
  checkIsWaterlogged,
  computeAnalysisConfidence,
  computeWeatherWindowSummary,
  getEffectivePrimaryCauses,
  RETENTION_ENRICHMENT_BY_ID,
} from "@/lib/reportHelpers";

interface BasicFarmerReportProps {
  analysis: AnalysisResponse;
  cropLabel: string;
  weatherSeries: DailyWeatherPoint[];
  isArchive: boolean;
  onOpenFullReport: () => void;
}

export default function BasicFarmerReport({
  analysis,
  cropLabel,
  weatherSeries,
  isArchive,
  onOpenFullReport,
}: BasicFarmerReportProps) {
  const { step1_diagnosis: diagnosis, step3_irrigation: irrigation, metadata } =
    analysis;
  const areaHa = analysis.parcel_info.area_ha;
  const isWaterlogged = checkIsWaterlogged(diagnosis);
  const causes = getEffectivePrimaryCauses(diagnosis);
  const retentionActions = adaptRetentionRecommendations(
    analysis.step2_retention,
    diagnosis
  );
  const weatherWindow = computeWeatherWindowSummary(
    irrigation,
    diagnosis,
    weatherSeries,
    isArchive
  );
  const confidence = computeAnalysisConfidence(metadata, diagnosis);

  const normalizedRisk = diagnosis.drought_risk_level.toUpperCase();
  const riskPresentation = isWaterlogged
    ? {
        badge: "NADMIAR WODY",
        headline: "Na polu jest za dużo wody — ryzyko zastoisk",
        calloutClass: "gov-callout-warning",
        textClass: "text-gov-warning",
      }
    : normalizedRisk === "WYSOKIE" || normalizedRisk === "HIGH"
      ? {
          badge: "WYSOKIE RYZYKO SUSZY",
          headline: "Twoje pole odczuwa wyraźny niedobór wody",
          calloutClass: "gov-callout-danger",
          textClass: "text-gov-danger",
        }
      : normalizedRisk === "UMIARKOWANE" || normalizedRisk === "MEDIUM"
        ? {
            badge: "UMIARKOWANE RYZYKO SUSZY",
            headline: "Zapas wody w glebie spada — warto go chronić",
            calloutClass: "gov-callout-warning",
            textClass: "text-gov-warning",
          }
        : {
            badge: "NISKIE RYZYKO SUSZY",
            headline: "Uwilgotnienie pola jest obecnie w normie",
            calloutClass: "gov-callout-success",
            textClass: "text-gov-success",
          };

  const totalCubicMeters = Math.round(irrigation.dose_m3_per_ha * areaHa);

  const confidenceBadgeClass =
    confidence.level === "WYSOKA"
      ? "bg-gov-success-bg text-gov-success border-gov-success/30"
      : confidence.level === "ŚREDNIA"
        ? "bg-gov-blue-light text-gov-blue border-gov-blue/30"
        : "bg-gov-warning-bg text-gov-warning border-gov-warning/30";

  return (
    <div className="space-y-8 print:space-y-5">
      {/* ETAP 1: Prosta diagnoza dla rolnika */}
      <section className="pt-6 border-t-2 border-gov-navy space-y-5 print:pt-4 print:space-y-3">
        <div>
          <p className="text-xs font-bold text-gov-blue mb-1">
            Etap 1 z 3 — Co dzieje się na polu?
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-gov-navy">
            1. Sytuacja wodna na działce ({cropLabel})
          </h2>
        </div>

        <div className={riskPresentation.calloutClass}>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-xs font-bold uppercase tracking-wide ${riskPresentation.textClass}`}
            >
              {riskPresentation.badge}
            </span>
          </div>
          <div className="text-base sm:text-lg font-bold text-gov-navy mt-1">
            {riskPresentation.headline}
          </div>
          <p className="text-sm text-gov-text mt-1 leading-relaxed">
            W ciągu ostatnich 30 dni na każdym metrze kwadratowym pola{" "}
            {diagnosis.kbw_30d_mm < 0 ? (
              <>
                <strong className="text-gov-danger">
                  brakuje ok. {Math.abs(diagnosis.kbw_30d_mm).toFixed(0)} litrów
                  wody
                </strong>{" "}
                (bilans {diagnosis.kbw_30d_mm.toFixed(1)} mm).
              </>
            ) : (
              <>
                <strong className="text-gov-success">
                  jest nadwyżka ok. {diagnosis.kbw_30d_mm.toFixed(0)} litrów
                  wody
                </strong>{" "}
                (bilans +{diagnosis.kbw_30d_mm.toFixed(1)} mm).
              </>
            )}
          </p>
        </div>

        {/* 3 proste karty z kluczowymi faktami o polu */}
        <div className="grid grid-cols-1 sm:grid-cols-3 print:grid-cols-3 gap-4 print:gap-2.5 tabular-nums print:break-inside-avoid">
          <div className="border border-gov-border bg-gov-surface/50 p-4 space-y-1">
            <div className="text-xs font-bold text-gov-secondary">
              Bilans wody (ostatnie 30 dni)
            </div>
            <div
              className={`text-xl font-mono font-bold ${
                diagnosis.kbw_30d_mm < -50
                  ? "text-gov-danger"
                  : diagnosis.kbw_30d_mm < 0
                    ? "text-gov-warning"
                    : "text-gov-success"
              }`}
            >
              {diagnosis.kbw_30d_mm > 0 ? "+" : ""}
              {diagnosis.kbw_30d_mm.toFixed(0)} l/m²
            </div>
            <div className="text-xs text-gov-secondary">
              {diagnosis.kbw_30d_mm < 0
                ? "więcej wyparowało niż spadło deszczu"
                : "opady przewyższyły parowanie"}
            </div>
          </div>

          <div className="border border-gov-border bg-gov-surface/50 p-4 space-y-1">
            <div className="text-xs font-bold text-gov-secondary">
              Twoja gleba i jej pojemność
            </div>
            <div className="text-base font-bold text-gov-navy capitalize">
              Gleba {diagnosis.soil_category}
            </div>
            <div className="text-xs text-gov-secondary">
              Warstwa orna zatrzymuje ok.{" "}
              <strong className="font-mono text-gov-text">
                {diagnosis.awc_mm.toFixed(0)} l/m²
              </strong>{" "}
              ({diagnosis.soil_texture}).
            </div>
          </div>

          <div className="border border-gov-border bg-gov-surface/50 p-4 space-y-1">
            <div className="text-xs font-bold text-gov-secondary">
              Teren i rowy melioracyjne
            </div>
            <div className="text-base font-bold text-gov-navy">
              {diagnosis.distance_to_ditch_m != null
                ? `Rów ok. ${Math.round(diagnosis.distance_to_ditch_m)} m od pola`
                : "Brak rowów w promieniu 500 m"}
            </div>
            <div className="text-xs text-gov-secondary">
              Nachylenie terenu:{" "}
              <strong className="font-mono text-gov-text">
                {diagnosis.slope_percent != null
                  ? `${diagnosis.slope_percent.toFixed(1)}%`
                  : "brak danych"}
              </strong>
              {diagnosis.aspect_direction
                ? ` (spływ: ${diagnosis.aspect_direction})`
                : ""}
              .
            </div>
            {diagnosis.nearest_river && (
              <div className="text-xs text-gov-secondary pt-1 border-t border-gov-border/60">
                Stacja IMGW:{" "}
                <strong className="text-gov-navy">
                  rzeka {diagnosis.nearest_river}
                </strong>
                {diagnosis.water_level_cm != null && (
                  <span className="font-mono">
                    {" "}
                    (stan: {diagnosis.water_level_cm} cm)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Prosta lista przyczyn */}
        <div className="space-y-2 print:break-inside-avoid">
          <h3 className="text-sm font-bold text-gov-navy">
            Dlaczego taka jest sytuacja na działce?
          </h3>
          <ul className="list-disc list-inside space-y-1.5 text-sm text-gov-text bg-white border border-gov-border p-4 print:p-3">
            {causes.map((cause, idx) => (
              <li key={idx} className="leading-relaxed">
                {cause}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ETAP 2: Konkretne działania retencyjne (priorytet) */}
      <section className="pt-6 border-t-2 border-gov-navy space-y-5 print:pt-4 print:space-y-3">
        <div>
          <p className="text-xs font-bold text-gov-success mb-1">
            Etap 2 z 3 — Priorytet przed nawadnianiem
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-gov-navy">
            2. Co zrobić najpierw, żeby zatrzymać wodę na polu?
          </h2>
          <p className="text-sm text-gov-secondary mt-1">
            Zanim uruchomisz deszczownię, wdróż poniższe zabiegi — zatrzymują
            deszczówkę w glebie i dają trwały efekt (część kwalifikuje się do
            dopłat ARiMR).
          </p>
        </div>

        <div className="space-y-4 print:space-y-2.5">
          {retentionActions.map((rec, index) => {
            const fallback = RETENTION_ENRICHMENT_BY_ID[rec.id];
            const waterGainMm = rec.water_gain_mm ?? fallback?.water_gain_mm;
            const bufferDays =
              rec.drought_buffer_days ?? fallback?.drought_buffer_days;
            const ecoschemeName =
              rec.ecoscheme_name ?? fallback?.ecoscheme_name;
            const ecoschemePln =
              rec.ecoscheme_pln_per_ha ?? fallback?.ecoscheme_pln_per_ha;

            return (
              <div
                key={rec.id}
                className="border border-gov-border bg-white p-5 space-y-3 print:p-3.5 print:space-y-2 print:break-inside-avoid"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-base font-bold text-gov-navy">
                    {index + 1}. {rec.title}
                  </h3>
                  <span className="text-xs font-bold text-gov-success bg-gov-success-bg border border-gov-border px-2 py-0.5 rounded-[2px]">
                    {rec.badge}
                  </span>
                </div>

                <p className="text-sm text-gov-text leading-relaxed font-medium">
                  {rec.action}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gov-border/60 text-xs">
                  <div className="flex flex-wrap items-center gap-2 tabular-nums">
                    {waterGainMm != null && (
                      <span className="px-2 py-0.5 bg-gov-blue-light text-gov-navy font-bold rounded-[2px]">
                        Zysk wody: +{waterGainMm} l/m²
                      </span>
                    )}
                    {bufferDays != null && (
                      <span className="px-2 py-0.5 bg-gov-success-bg text-gov-success font-bold rounded-[2px]">
                        +{bufferDays} dni odporności na suszę
                      </span>
                    )}
                  </div>
                  {ecoschemeName && (
                    <span className="text-gov-secondary">
                      <strong className="text-gov-navy">Wsparcie ARiMR:</strong>{" "}
                      {ecoschemePln != null
                        ? `ok. ${ecoschemePln} PLN/ha`
                        : "możliwe dofinansowanie"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ETAP 3: Prosta decyzja o nawadnianiu */}
      <section className="pt-6 border-t-2 border-gov-navy space-y-5 print:pt-4 print:space-y-3">
        <div>
          <p className="text-xs font-bold text-gov-blue mb-1">
            Etap 3 z 3 — Decyzja o podlewaniu
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-gov-navy">
            3. Czy trzeba teraz nawadniać ({cropLabel})?
          </h2>
        </div>

        {irrigation.needed ? (
          <div className="space-y-4 print:space-y-3">
            <div className="gov-callout-info">
              <div className="text-base font-bold text-gov-navy">
                Tak — zalecane nawadnianie interwencyjne ({irrigation.dose_mm.toFixed(0)} l/m²)
              </div>
              <p className="text-sm text-gov-text mt-1 leading-relaxed">
                {irrigation.justification}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 print:grid-cols-3 gap-4 print:gap-2.5 tabular-nums print:break-inside-avoid">
              <div className="border border-gov-border bg-white p-4">
                <div className="text-xs font-bold text-gov-secondary">
                  Jednorazowa dawka wody
                </div>
                <div className="text-xl font-mono font-bold text-gov-navy mt-1">
                  {irrigation.dose_mm.toFixed(1)} mm
                </div>
                <div className="text-xs text-gov-secondary">
                  czyli {Math.round(irrigation.dose_m3_per_ha)} m³ na 1 ha
                </div>
              </div>

              <div className="border border-gov-border bg-white p-4">
                <div className="text-xs font-bold text-gov-secondary">
                  Na całą działkę ({areaHa} ha)
                </div>
                <div className="text-xl font-mono font-bold text-gov-blue mt-1">
                  {totalCubicMeters} m³
                </div>
                <div className="text-xs text-gov-secondary">
                  łączna objętość zabiegu
                </div>
              </div>

              <div className="border border-gov-border bg-white p-4">
                <div className="text-xs font-bold text-gov-secondary">
                  Kiedy i jak podlewać
                </div>
                <div className="text-sm font-bold text-gov-navy mt-1">
                  {irrigation.recommended_timing}
                </div>
                <div className="text-xs text-gov-secondary mt-0.5">
                  {irrigation.recommended_technique}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="gov-callout-success">
            <div className="text-base font-bold text-gov-navy">
              Nie — dodatkowe nawadnianie nie jest teraz potrzebne
            </div>
            <p className="text-sm text-gov-text mt-1 leading-relaxed">
              {irrigation.justification}
            </p>
          </div>
        )}

        <div
          className={`border px-4 py-3 text-xs sm:text-sm ${
            weatherWindow.tone === "warning"
              ? "border-gov-warning/40 bg-gov-warning-bg text-gov-text"
              : "border-gov-border bg-gov-surface/60 text-gov-text"
          }`}
        >
          <strong className="text-gov-navy">
            Pogoda na najbliższe 7 dni:
          </strong>{" "}
          {weatherWindow.text}
        </div>
      </section>

      {/* Transparentność + CTA do pełnego raportu szczegółowego */}
      <section className="pt-6 border-t border-gov-border space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-gov-surface border border-gov-border px-4 py-3 text-xs print:break-inside-avoid">
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-gov-navy">
                Poziom pewności analizy:
              </span>
              <span
                className={`inline-block px-2 py-0.5 text-[11px] font-bold border rounded-[2px] ${confidenceBadgeClass}`}
              >
                {confidence.level} ({confidence.score}%)
              </span>
            </div>
            <p className="text-gov-secondary leading-relaxed">
              {confidence.explanation}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenFullReport}
            className="text-gov-blue hover:underline font-semibold whitespace-nowrap print:hidden"
          >
            Zobacz źródła i ograniczenia →
          </button>
        </div>

        {/* Wyraźne przejście do pełnego raportu (ukryte przy druku) */}
        <div className="border-2 border-gov-blue bg-gov-blue-light p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <div className="space-y-1">
            <div className="text-base font-bold text-gov-navy">
              Chcesz zobaczyć pełny raport szczegółowy (doradczy)?
            </div>
            <p className="text-xs sm:text-sm text-gov-secondary leading-relaxed">
              Zawiera wykres bilansu wodnego (120 dni), wskaźniki satelitarne
              Sentinel-2 (NDVI/NDMI), mapę hydrologiczną działki, prognozę na 6
              dekad, porównanie płodozmianu oraz pełny wykaz źródeł z
              licencjami i ograniczeniami.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenFullReport}
            className="gov-btn-primary shrink-0 px-6 py-3"
          >
            Otwórz pełny raport szczegółowy →
          </button>
        </div>
      </section>
    </div>
  );
}
