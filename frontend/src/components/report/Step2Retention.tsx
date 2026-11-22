"use client";

import React from "react";
import { Diagnosis, RetentionAction } from "@/types/analysis";
import {
  adaptRetentionRecommendations,
  RETENTION_ENRICHMENT_BY_ID,
} from "@/lib/reportHelpers";

interface Step2RetentionProps {
  recommendations: RetentionAction[];
  diagnosis?: Diagnosis;
}

export default function Step2Retention({
  recommendations,
  diagnosis,
}: Step2RetentionProps) {
  const adaptedRecommendations: RetentionAction[] = React.useMemo(
    () => adaptRetentionRecommendations(recommendations, diagnosis),
    [diagnosis, recommendations]
  );
  return (
    <section className="pt-8 border-t-2 border-gov-navy space-y-6 print:pt-4 print:space-y-4">
      <div>
        <p className="text-xs font-bold text-gov-success mb-1">
          Etap 2 z 3 — Priorytet przed nawadnianiem
        </p>
        <h2 className="text-xl sm:text-2xl font-bold text-gov-navy">
          2. Rekomendacje retencyjne i agrotechniczne
        </h2>
      </div>

      <div className="gov-callout-success">
        <div className="text-sm font-bold text-gov-navy">
          Zasada priorytetu retencji (KOWR): Zatrzymaj wodę tam, gdzie spadnie
        </div>
        <p className="text-sm text-gov-text mt-1 leading-relaxed">
          Zanim zastosujesz nawadnianie, wdróż zabiegi zatrzymujące wodę opadową
          w glebie i spowalniające jej odpływ z pola. Są to działania o
          najwyższej skuteczności i trwałym efekcie dla gospodarstwa.
        </p>
      </div>

      <div className="border border-gov-border divide-y divide-gov-border bg-white">
        {adaptedRecommendations.map((rec, index) => {
          const fallback = RETENTION_ENRICHMENT_BY_ID[rec.id];
          const waterGainMm = rec.water_gain_mm ?? fallback?.water_gain_mm;
          const bufferDays =
            rec.drought_buffer_days ?? fallback?.drought_buffer_days;
          const ecoschemeName = rec.ecoscheme_name ?? fallback?.ecoscheme_name;
          const ecoschemeCode = rec.ecoscheme_code ?? fallback?.ecoscheme_code;
          const ecoschemePln =
            rec.ecoscheme_pln_per_ha ?? fallback?.ecoscheme_pln_per_ha;

          return (
            <div
              key={rec.id}
              className="p-5 sm:p-6 space-y-4 print:p-3.5 print:space-y-2.5 print:break-inside-avoid"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-gov-border">
                <h3 className="text-base sm:text-lg font-bold text-gov-navy">
                  {index + 1}. {rec.title}
                </h3>
                <span className="text-xs font-bold text-gov-success bg-gov-success-bg border border-gov-border px-2.5 py-1 rounded-[2px]">
                  {rec.badge}
                </span>
              </div>

              {(waterGainMm != null || bufferDays != null) && (
                <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
                  {waterGainMm != null && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gov-blue-light border border-gov-blue/25 text-gov-navy font-bold rounded-[2px]">
                      Szacowany zysk retencji:{" "}
                      <span className="font-mono text-gov-blue">
                        +{waterGainMm} mm
                      </span>{" "}
                      ({waterGainMm * 10} m³/ha)
                    </span>
                  )}
                  {bufferDays != null && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gov-success-bg border border-gov-success/25 text-gov-navy font-bold rounded-[2px]">
                      Bufor suszowy:{" "}
                      <span className="font-mono text-gov-success">
                        +{bufferDays} dni
                      </span>{" "}
                      bez stresu wodnego
                    </span>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-12 print:grid-cols-12 gap-5 print:gap-4 text-sm">
                <div className="md:col-span-6 print:col-span-6 space-y-1">
                  <div className="text-xs font-bold text-gov-secondary">
                    Dlaczego zalecamy na tej działce (diagnoza)
                  </div>
                  <p className="text-gov-text leading-relaxed">{rec.why}</p>
                </div>

                <div className="md:col-span-6 print:col-span-6 md:border-l print:border-l md:border-gov-border print:border-gov-border md:pl-5 print:pl-4 space-y-1">
                  <div className="text-xs font-bold text-gov-navy">
                    Co konkretnie zrobić na polu (działanie)
                  </div>
                  <p className="text-gov-text font-medium leading-relaxed">
                    {rec.action}
                  </p>
                </div>
              </div>

              {ecoschemeName && (
                <div className="pt-3 border-t border-gov-border/70 flex flex-wrap items-center justify-between gap-2 text-xs bg-gov-surface/70 px-3 py-2 rounded-[2px]">
                  <div className="text-gov-text">
                    <span className="font-bold text-gov-navy">
                      Możliwe wsparcie ARiMR / WPR:
                    </span>{" "}
                    {ecoschemeName}
                    {ecoschemeCode && (
                      <span className="ml-1.5 font-mono text-[11px] text-gov-secondary">
                        ({ecoschemeCode})
                      </span>
                    )}
                  </div>
                  {ecoschemePln != null && (
                    <span className="font-mono font-bold text-gov-success whitespace-nowrap">
                      orientacyjnie ~{ecoschemePln} PLN/ha
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
