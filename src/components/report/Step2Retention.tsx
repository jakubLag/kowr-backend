"use client";

import React from "react";
import { RetentionRecommendation } from "@/types/analysis";

interface Step2RetentionProps {
  recommendations: RetentionRecommendation[];
}

export default function Step2Retention({
  recommendations,
}: Step2RetentionProps) {
  return (
    <section className="pt-8 border-t-2 border-gov-navy space-y-5 print:break-inside-avoid">
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
          Zasada priorytetu retencji (KOWR)
        </div>
        <p className="text-sm text-gov-text mt-1 leading-relaxed">
          Zanim zastosujesz nawadnianie, wdróż zabiegi zatrzymujące wodę opadową
          w glebie i spowalniające jej odpływ z pola. Są to działania o
          najwyższej opłacalności i trwałym efekcie dla gospodarstwa.
        </p>
      </div>

      <table className="gov-table border border-gov-border">
        <thead>
          <tr>
            <th className="w-14">Lp.</th>
            <th className="w-48">Obszar działania</th>
            <th>Zalecany zabieg i uzasadnienie dla Twojej działki</th>
          </tr>
        </thead>
        <tbody>
          {recommendations.map((rec, idx) => (
            <tr key={idx}>
              <td className="font-mono font-bold text-gov-navy">
                {idx + 1}.
              </td>
              <td className="font-bold text-gov-navy">{rec.category}</td>
              <td>
                <div className="font-bold text-gov-text text-base">
                  {rec.title}
                </div>
                <p className="text-sm text-gov-secondary mt-1 leading-relaxed">
                  <strong className="text-gov-text font-semibold">
                    Uzasadnienie:
                  </strong>{" "}
                  {rec.justification}
                </p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
