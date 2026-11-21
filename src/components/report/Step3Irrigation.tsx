"use client";

import React from "react";
import {
  DailyWeatherPoint,
  IrrigationRecommendation,
} from "@/types/analysis";
import { RetentionSimulationSummary } from "@/lib/retentionSimulator";

interface Step3IrrigationProps {
  irrigation: IrrigationRecommendation;
  areaHa: number;
  cropName: string;
  simulation: RetentionSimulationSummary;
  forecastDays: DailyWeatherPoint[];
}

function getDayWindowEvaluation(day: DailyWeatherPoint) {
  if (day.precipitation_mm >= 6.0) {
    return {
      status: "Wstrzymaj nawadnianie (prognozowany deszcz)",
      statusClass: "text-gov-blue font-bold",
      rowClass: "bg-gov-blue-light/50",
    };
  }
  if ((day.wind_max_ms ?? 0) > 4.5) {
    return {
      status: "Odradzane w dzień (silny wiatr — straty na znoszenie)",
      statusClass: "text-gov-warning font-bold",
      rowClass: "bg-white",
    };
  }
  return {
    status: "Dobre okno zabiegowe (godziny wieczorne / nocne)",
    statusClass: "text-gov-success font-bold",
    rowClass: "bg-white",
  };
}

export default function Step3Irrigation({
  irrigation,
  areaHa,
  cropName,
  simulation,
  forecastDays,
}: Step3IrrigationProps) {
  const baseTotalM3 = Math.round(irrigation.dose_m3_per_ha * areaHa);
  const adjustedDoseMm = simulation.irrigationDoseAfterMm;
  const adjustedM3PerHa = Math.round(adjustedDoseMm * 10);
  const adjustedTotalM3 = Math.round(adjustedM3PerHa * areaHa);

  const forecast7dRainSum = Number(
    forecastDays
      .reduce((acc, d) => acc + d.precipitation_mm, 0)
      .toFixed(1)
  );

  return (
    <section className="pt-8 border-t-2 border-gov-navy space-y-6 print:break-inside-avoid">
      <div>
        <p className="text-xs font-bold text-gov-blue mb-1">
          Etap 3 z 3 — Zabieg uzupełniający i 7-dniowe okno pogodowe
        </p>
        <h2 className="text-xl sm:text-2xl font-bold text-gov-navy">
          3. Rekomendacje dotyczące nawadniania ({cropName})
        </h2>
      </div>

      {irrigation.needed ? (
        <div className="space-y-6">
          <div className="gov-callout-info">
            <div className="text-sm font-bold text-gov-navy">
              Status: {irrigation.status}
            </div>
            <p className="text-sm text-gov-text mt-1 leading-relaxed">
              {irrigation.justification}
            </p>
            {simulation.selectedCount > 0 && (
              <p className="text-xs text-gov-navy font-semibold mt-2">
                Po uwzględnieniu {simulation.selectedCount} zabiegów
                retencyjnych zaznaczonych w Etapie 2 wymagana dawka nawadniania
                spada z{" "}
                <span className="font-mono">
                  {irrigation.dose_mm.toFixed(1)} mm
                </span>{" "}
                do{" "}
                <span className="font-mono">
                  {adjustedDoseMm.toFixed(1)} mm
                </span>{" "}
                (oszczędność{" "}
                <span className="font-mono">
                  {simulation.savedIrrigationM3Parcel} m³
                </span>{" "}
                wody na działce).
              </p>
            )}
          </div>

          <table className="gov-table border border-gov-border tabular-nums">
            <thead>
              <tr>
                <th className="w-2/5">Parametr nawadniania</th>
                <th>Wartość bazowa (bez retencji)</th>
                <th>Po wdrożeniu retencji z Etapu 2</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-bold">Zalecana dawka jednostkowa</td>
                <td className="font-mono text-gov-secondary">
                  {irrigation.dose_mm.toFixed(1)} mm ({irrigation.dose_mm.toFixed(1)} l/m²)
                </td>
                <td className="font-mono font-bold text-base text-gov-navy">
                  {adjustedDoseMm.toFixed(1)} mm ({adjustedDoseMm.toFixed(1)} l/m²)
                </td>
              </tr>
              <tr>
                <td className="font-bold">Objętość wody na 1 hektar</td>
                <td className="font-mono text-gov-secondary">
                  {Math.round(irrigation.dose_m3_per_ha)} m³ / ha
                </td>
                <td className="font-mono font-bold text-gov-navy">
                  {adjustedM3PerHa} m³ / ha
                </td>
              </tr>
              <tr>
                <td className="font-bold">
                  Całkowita objętość dla działki ({areaHa} ha)
                </td>
                <td className="font-mono text-gov-secondary">
                  {baseTotalM3} m³ wody
                </td>
                <td className="font-mono font-bold text-gov-blue">
                  {adjustedTotalM3} m³ wody
                </td>
              </tr>
              <tr>
                <td className="font-bold">Rekomendowana technika</td>
                <td colSpan={2} className="font-semibold text-gov-text">
                  {irrigation.recommended_technique}
                </td>
              </tr>
              <tr>
                <td className="font-bold">Optymalna pora wykonania zabiegu</td>
                <td colSpan={2} className="font-semibold text-gov-text">
                  {irrigation.recommended_timing}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="gov-callout-success">
          <div className="text-sm font-bold text-gov-navy">
            Status: {irrigation.status}
          </div>
          <p className="text-sm text-gov-text mt-1 leading-relaxed">
            {irrigation.justification}
          </p>
        </div>
      )}

      {/* 3.1. 7-dniowe okno pogodowe na zabieg (Open-Meteo Forecast) */}
      {forecastDays.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-base font-bold text-gov-navy">
              3.1. 7-dniowe okno pogodowe dla zabiegów wodnych (prognoza
              Open-Meteo)
            </h3>
            <span className="text-xs font-semibold text-gov-secondary tabular-nums">
              Suma prognozowanych opadów (7 dni):{" "}
              <strong className="font-mono text-gov-blue">
                {forecast7dRainSum} mm
              </strong>
            </span>
          </div>
          <p className="text-xs text-gov-secondary leading-relaxed">
            Harmonogram pomaga uniknąć uruchamiania deszczowni tuż przed
            nadchodzącym deszczem oraz w dni z silnym wiatrem powodującym straty
            wody.
          </p>

          <table className="gov-table border border-gov-border tabular-nums">
            <thead>
              <tr>
                <th>Data (prognoza)</th>
                <th className="text-right">Prognozowany opad</th>
                <th className="text-right">Parowanie (ET0)</th>
                <th className="text-right">Wiatr maks.</th>
                <th>Rekomendacja operacyjna na dany dzień</th>
              </tr>
            </thead>
            <tbody>
              {forecastDays.map((day) => {
                const evalInfo = getDayWindowEvaluation(day);
                return (
                  <tr key={day.date} className={evalInfo.rowClass}>
                    <td className="font-mono font-bold">{day.date}</td>
                    <td className="text-right font-mono font-bold text-gov-blue">
                      {day.precipitation_mm.toFixed(1)} mm
                    </td>
                    <td className="text-right font-mono text-gov-secondary">
                      {day.et0_mm.toFixed(1)} mm
                    </td>
                    <td className="text-right font-mono text-gov-secondary">
                      {day.wind_max_ms != null
                        ? `${day.wind_max_ms.toFixed(1)} m/s`
                        : "—"}
                    </td>
                    <td className={`text-xs ${evalInfo.statusClass}`}>
                      {evalInfo.status}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
