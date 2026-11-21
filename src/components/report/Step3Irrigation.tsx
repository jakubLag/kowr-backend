"use client";

import React from "react";
import { Step3IrrigationRecommendations } from "@/types/analysis";

interface Step3IrrigationProps {
  irrigation: Step3IrrigationRecommendations;
  areaHa: number;
  cropName: string;
}

export default function Step3Irrigation({
  irrigation,
  areaHa,
  cropName,
}: Step3IrrigationProps) {
  // 1 mm = 1 l/m² = 10 m³/ha
  const cubicMetersPerHa = Math.round(irrigation.recommended_dose_mm * 10);
  const totalCubicMeters = Math.round(cubicMetersPerHa * areaHa);

  return (
    <section className="pt-8 border-t-2 border-gov-navy space-y-5 print:break-inside-avoid">
      <div>
        <p className="text-xs font-bold text-gov-blue mb-1">
          Etap 3 z 3 — Zabieg uzupełniający
        </p>
        <h2 className="text-xl sm:text-2xl font-bold text-gov-navy">
          3. Rekomendacje dotyczące nawadniania ({cropName})
        </h2>
      </div>

      {irrigation.is_recommended ? (
        <div className="space-y-5">
          <div className="gov-callout-info">
            <div className="text-sm font-bold text-gov-navy">
              Status: Zalecane nawadnianie interwencyjne
            </div>
            <p className="text-sm text-gov-text mt-1 leading-relaxed">
              {irrigation.justification}
            </p>
          </div>

          <table className="gov-table border border-gov-border tabular-nums">
            <thead>
              <tr>
                <th className="w-2/5">Parametr nawadniania</th>
                <th>Wartość wyliczona dla działki</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-bold">Zalecana dawka jednostkowa</td>
                <td className="font-mono font-bold text-base text-gov-navy">
                  {irrigation.recommended_dose_mm} mm{" "}
                  <span className="text-sm font-normal text-gov-secondary">
                    (odpowiada {irrigation.recommended_dose_mm} litrom wody na 1
                    m²)
                  </span>
                </td>
              </tr>
              <tr>
                <td className="font-bold">Objętość wody na 1 hektar</td>
                <td className="font-mono font-bold">
                  {cubicMetersPerHa} m³ / ha
                </td>
              </tr>
              <tr>
                <td className="font-bold">
                  Całkowite zapotrzebowanie na wodę dla działki ({areaHa} ha)
                </td>
                <td className="font-mono font-bold text-gov-blue">
                  {totalCubicMeters} m³ wody
                </td>
              </tr>
              <tr>
                <td className="font-bold">Optymalny termin wykonania zabiegu</td>
                <td className="font-semibold text-gov-text">
                  {irrigation.timing}
                  <span className="block text-xs font-normal text-gov-secondary mt-0.5">
                    Wskazówka: Nawadnianie wieczorne lub nocne ogranicza straty
                    wody przez parowanie o około 30–35%.
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="gov-callout-success">
          <div className="text-sm font-bold text-gov-navy">
            Status: Dodatkowe nawadnianie nie jest obecnie wymagane
          </div>
          <p className="text-sm text-gov-text mt-1 leading-relaxed">
            {irrigation.justification}
          </p>
          <p className="text-xs text-gov-secondary mt-2">
            Zalecenie czasowe: {irrigation.timing}. Należy kontynuować działania
            retencyjne wskazane w Etapie 2.
          </p>
        </div>
      )}
    </section>
  );
}
