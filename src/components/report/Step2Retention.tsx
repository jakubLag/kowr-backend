"use client";

import React from "react";
import { RetentionAction } from "@/types/analysis";
import {
  getRetentionActionImpact,
  RetentionSimulationSummary,
} from "@/lib/retentionSimulator";

interface Step2RetentionProps {
  recommendations: RetentionAction[];
  selectedIds: string[];
  onToggleAction: (id: string) => void;
  simulation: RetentionSimulationSummary;
  baseAwcMm: number;
  areaHa: number;
}

export default function Step2Retention({
  recommendations,
  selectedIds,
  onToggleAction,
  simulation,
  baseAwcMm,
  areaHa,
}: Step2RetentionProps) {
  return (
    <section className="pt-8 border-t-2 border-gov-navy space-y-6 print:break-inside-avoid">
      <div>
        <p className="text-xs font-bold text-gov-success mb-1">
          Etap 2 z 3 — Priorytet przed nawadnianiem + Symulator efektów
        </p>
        <h2 className="text-xl sm:text-2xl font-bold text-gov-navy">
          2. Rekomendacje retencyjne, symulator „Przed / Po” i dopłaty ARiMR
        </h2>
      </div>

      <div className="gov-callout-success">
        <div className="text-sm font-bold text-gov-navy">
          Zasada priorytetu retencji (KOWR): Zatrzymaj wodę tam, gdzie spadnie
        </div>
        <p className="text-sm text-gov-text mt-1 leading-relaxed">
          Zaznacz lub odznacz poniższe zabiegi w kolumnie{" "}
          <strong>„Symuluj wdrożenie”</strong>, aby sprawdzić na żywo, ile
          metrów sześciennych wody zatrzymasz na swojej działce ({areaHa} ha), o
          ile zmniejszysz dawkę nawadniania w Etapie 3 oraz jaką dopłatę z
          Ekoschematów ARiMR możesz uzyskać.
        </p>
      </div>

      {/* Tabela rekomendacji z przełącznikami symulatora */}
      <table className="gov-table border border-gov-border tabular-nums">
        <thead>
          <tr>
            <th className="w-28 print:hidden">Symuluj wdrożenie</th>
            <th className="w-44">Kategoria i priorytet</th>
            <th>Zalecany zabieg i uzasadnienie</th>
            <th className="w-36 text-right">Zysk wody na polu</th>
            <th className="w-44 text-right">Ekoschemat / Dopłata ARiMR</th>
          </tr>
        </thead>
        <tbody>
          {recommendations.map((rec) => {
            const isChecked = selectedIds.includes(rec.id);
            const impact = getRetentionActionImpact(rec);
            const parcelWaterM3 = Math.round(impact.waterGainM3PerHa * areaHa);
            const parcelSubsidyPln = Math.round(
              impact.ecoschemePlnPerHa * areaHa
            );

            return (
              <tr
                key={rec.id}
                onClick={() => onToggleAction(rec.id)}
                className={`cursor-pointer transition-colors ${
                  isChecked
                    ? "bg-gov-success-bg/60"
                    : "bg-white opacity-70 hover:opacity-100"
                }`}
              >
                <td
                  className="print:hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-xs text-gov-navy">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onToggleAction(rec.id)}
                      className="w-4 h-4 accent-gov-success"
                    />
                    <span>{isChecked ? "Włączone" : "Pominięte"}</span>
                  </label>
                </td>
                <td>
                  <div className="font-mono text-xs font-bold text-gov-navy">
                    Priorytet #{rec.priority}
                  </div>
                  <div className="text-xs font-semibold text-gov-secondary mt-0.5">
                    {rec.badge}
                  </div>
                </td>
                <td className="space-y-1.5">
                  <div className="font-bold text-gov-text text-base">
                    {rec.title}
                  </div>
                  <p className="text-xs sm:text-sm text-gov-secondary leading-relaxed">
                    <strong className="text-gov-text font-semibold">
                      Uzasadnienie:
                    </strong>{" "}
                    {rec.why}
                  </p>
                  <p className="text-xs sm:text-sm text-gov-text leading-relaxed">
                    <strong className="text-gov-navy font-semibold">
                      Działanie:
                    </strong>{" "}
                    {rec.action}
                  </p>
                </td>
                <td className="text-right font-mono">
                  <div className="font-bold text-gov-success text-sm">
                    +{impact.waterGainMm.toFixed(1)} mm
                  </div>
                  <div className="text-xs text-gov-text font-semibold">
                    +{parcelWaterM3} m³ ({areaHa} ha)
                  </div>
                  <div className="text-[11px] text-gov-secondary mt-0.5">
                    +{impact.droughtBufferDays} dni bez deszczu
                  </div>
                </td>
                <td className="text-right">
                  <div className="font-mono font-bold text-gov-navy text-sm">
                    ~{parcelSubsidyPln} zł / rok
                  </div>
                  <div className="text-xs font-mono text-gov-secondary">
                    ({impact.ecoschemePlnPerHa} zł/ha)
                  </div>
                  <div className="text-[11px] text-gov-secondary mt-0.5 leading-snug">
                    {impact.ecoschemeName}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Podsumowanie Symulatora „Przed vs Po wdrożeniu” */}
      <div className="space-y-3 pt-2">
        <h3 className="text-base font-bold text-gov-navy">
          2.1. Wynik symulacji „Przed i Po” dla działki ({areaHa} ha) przy
          wdrożeniu {simulation.selectedCount} z {recommendations.length}{" "}
          zaleceń
        </h3>

        <table className="gov-table border border-gov-border tabular-nums">
          <thead>
            <tr>
              <th>Badany wskaźnik</th>
              <th className="text-right">Stan obecny (bez zmian)</th>
              <th className="text-right">Po wdrożeniu wybranych zabiegów</th>
              <th className="text-right">Bilans korzyści dla rolnika</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-bold">
                Pojemność wodna gleby (AWC 0–30 cm)
              </td>
              <td className="text-right font-mono">
                {baseAwcMm.toFixed(1)} mm
              </td>
              <td className="text-right font-mono font-bold text-gov-success">
                {simulation.newAwcMm.toFixed(1)} mm
              </td>
              <td className="text-right font-mono font-bold text-gov-success">
                +{simulation.totalWaterGainMm.toFixed(1)} mm (+
                {simulation.totalWaterGainM3Parcel} m³ wody na polu)
              </td>
            </tr>
            <tr>
              <td className="font-bold">
                Odporność uprawy na okres bezopadowy
              </td>
              <td className="text-right font-mono text-gov-secondary">
                Bazowa rezerwa glebowa
              </td>
              <td className="text-right font-mono font-bold text-gov-navy">
                Wydłużona o +{simulation.totalBufferDays} dni
              </td>
              <td className="text-right font-semibold text-gov-text">
                Mniejsze ryzyko więdnięcia w fazie krytycznej
              </td>
            </tr>
            <tr>
              <td className="font-bold">
                Wymagana dawka nawadniania w Etapie 3
              </td>
              <td className="text-right font-mono">
                {simulation.irrigationDoseBeforeMm.toFixed(1)} mm
              </td>
              <td className="text-right font-mono font-bold text-gov-blue">
                {simulation.irrigationDoseAfterMm.toFixed(1)} mm
              </td>
              <td className="text-right font-mono font-bold text-gov-blue">
                {simulation.savedIrrigationM3Parcel > 0
                  ? `oszczędność ${simulation.savedIrrigationM3Parcel} m³ wody z deszczowni`
                  : "brak konieczności nawadniania"}
              </td>
            </tr>
            <tr className="bg-gov-surface">
              <td className="font-bold text-gov-navy">
                Szacowane wsparcie finansowe (Ekoschematy ARiMR)
              </td>
              <td className="text-right font-mono text-gov-secondary">0 zł</td>
              <td className="text-right font-mono font-bold text-gov-navy">
                ~{simulation.totalSubsidyPlnPerHa} zł / ha
              </td>
              <td className="text-right font-mono font-bold text-base text-gov-navy">
                ~{simulation.totalSubsidyPlnParcel} zł / rok dla działki
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
