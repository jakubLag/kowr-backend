"use client";

import React from "react";
import { RetentionAction } from "@/types/analysis";

interface Step2RetentionProps {
  recommendations: RetentionAction[];
}

export default function Step2Retention({
  recommendations,
}: Step2RetentionProps) {
  return (
    <section className="pt-8 border-t-2 border-gov-navy space-y-6 print:break-inside-avoid">
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
        {recommendations.map((rec, index) => (
          <div key={rec.id} className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-gov-border">
              <h3 className="text-base sm:text-lg font-bold text-gov-navy">
                {index + 1}. {rec.title}
              </h3>
              <span className="text-xs font-bold text-gov-success bg-gov-success-bg border border-gov-border px-2.5 py-1 rounded-[2px]">
                {rec.badge}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 text-sm">
              <div className="md:col-span-6 space-y-1">
                <div className="text-xs font-bold text-gov-secondary">
                  Dlaczego zalecamy na tej działce (diagnoza)
                </div>
                <p className="text-gov-text leading-relaxed">{rec.why}</p>
              </div>

              <div className="md:col-span-6 md:border-l md:border-gov-border md:pl-5 space-y-1">
                <div className="text-xs font-bold text-gov-navy">
                  Co konkretnie zrobić na polu (działanie)
                </div>
                <p className="text-gov-text font-medium leading-relaxed">
                  {rec.action}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
