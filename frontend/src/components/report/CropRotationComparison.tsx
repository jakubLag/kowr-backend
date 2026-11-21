"use client";

import React from "react";
import Link from "next/link";
import { CROP_OPTIONS, calculateCropKcForMonth } from "@/lib/crops";
import { Diagnosis } from "@/types/analysis";

interface CropRotationComparisonProps {
  teryt: string;
  currentCropId: string;
  currentKc: number;
  analysisDate: string;
  diagnosis: Diagnosis;
}

function evaluateProjectedRisk(
  projectedKbw30: number,
  projectedKbw60: number,
  soilCategory: string
): {
  level: "WYSOKIE" | "UMIARKOWANE" | "NISKIE";
  badgeClass: string;
} {
  const thresholds: Record<string, number> = {
    "bardzo lekka": -130.0,
    lekka: -160.0,
    średnia: -190.0,
    ciężka: -220.0,
  };
  const crit = thresholds[soilCategory.toLowerCase()] ?? -170.0;

  if (projectedKbw60 < crit || projectedKbw30 < crit * 0.65) {
    return {
      level: "WYSOKIE",
      badgeClass: "text-gov-danger font-bold",
    };
  }
  if (projectedKbw60 < crit * 0.6 || projectedKbw30 < crit * 0.35) {
    return {
      level: "UMIARKOWANE",
      badgeClass: "text-gov-warning font-bold",
    };
  }
  return {
    level: "NISKIE",
    badgeClass: "text-gov-success font-bold",
  };
}

export default function CropRotationComparison({
  teryt,
  currentCropId,
  currentKc,
  analysisDate,
  diagnosis,
}: CropRotationComparisonProps) {
  const dateOnly = analysisDate.split(" ")[0];
  const monthPart = parseInt(dateOnly.split("-")[1] || "7", 10);
  const month = Number.isNaN(monthPart) ? 7 : monthPart;

  // Wyznaczamy opad i ET0 z równania FAO-56: KBW = P - ET0 * Kc
  // Jeśli backend jeszcze nie przysłał jawnie precipitation_30d_mm / et0_30d_mm, estymujemy ET0 dla typowego okna
  const safeCurrentKc = Math.max(0.25, currentKc);
  const estEt0_30d =
    diagnosis.et0_30d_mm != null ? diagnosis.et0_30d_mm : 115.0;
  const estPrecip_30d =
    diagnosis.precipitation_30d_mm != null
      ? diagnosis.precipitation_30d_mm
      : diagnosis.kbw_30d_mm + estEt0_30d * safeCurrentKc;

  const estEt0_60d = estEt0_30d * 1.9;
  const estPrecip_60d = diagnosis.kbw_60d_mm + estEt0_60d * safeCurrentKc;

  const rows = CROP_OPTIONS.map((crop) => {
    const isCurrent = crop.id === currentCropId.toLowerCase();
    const kc = isCurrent
      ? safeCurrentKc
      : calculateCropKcForMonth(crop, month);
    const kbw30 = isCurrent
      ? diagnosis.kbw_30d_mm
      : Number((estPrecip_30d - estEt0_30d * kc).toFixed(1));
    const kbw60 = isCurrent
      ? diagnosis.kbw_60d_mm
      : Number((estPrecip_60d - estEt0_60d * kc).toFixed(1));

    const risk = evaluateProjectedRisk(kbw30, kbw60, diagnosis.soil_category);
    const diffVsCurrentMm = Number((kbw30 - diagnosis.kbw_30d_mm).toFixed(1));

    return {
      crop,
      isCurrent,
      kc,
      kbw30,
      kbw60,
      risk,
      diffVsCurrentMm,
    };
  }).sort((a, b) => b.kbw30 - a.kbw30);

  return (
    <section className="pt-8 border-t-2 border-gov-navy space-y-5 print:break-inside-avoid">
      <div>
        <p className="text-xs font-bold text-gov-blue mb-1">
          Planowanie płodozmianu — dopasowanie uprawy do gleby
        </p>
        <h2 className="text-xl sm:text-2xl font-bold text-gov-navy">
          Porównanie odporności upraw na suszę dla tej działki (gleba:{" "}
          {diagnosis.soil_category}, AWC: {diagnosis.awc_mm.toFixed(1)} mm)
        </h2>
        <p className="text-sm text-gov-secondary mt-1 leading-relaxed">
          Zestawienie pokazuje, jak na badanej działce zachowałyby się pozostałe
          uprawy w tym samym okresie (model FAO-56). Rośliny o głębszym systemie
          korzeniowym i niższym współczynniku Kc lepiej znoszą niedobory wody na
          glebach lekkich.
        </p>
      </div>

      <table className="gov-table border border-gov-border tabular-nums">
        <thead>
          <tr>
            <th>Uprawa w płodozmianie</th>
            <th className="text-right">Strefa korzeni</th>
            <th className="text-right">Współczynnik Kc</th>
            <th className="text-right">Bilans KBW (30 dni)</th>
            <th className="text-right">Różnica względem obecnej</th>
            <th className="text-right">Ryzyko suszy</th>
            <th className="text-right print:hidden">Akcja</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.crop.id}
              className={row.isCurrent ? "bg-gov-blue-light" : "bg-white"}
            >
              <td>
                <div className="font-bold text-gov-navy">
                  {row.crop.name_pl}
                  {row.isCurrent && (
                    <span className="ml-2 inline-block px-2 py-0.5 text-[11px] bg-gov-blue text-white font-semibold rounded-[2px]">
                      Badana uprawa
                    </span>
                  )}
                </div>
              </td>
              <td className="text-right font-mono text-xs text-gov-secondary">
                {row.crop.root_depth_m.toFixed(1)} m
              </td>
              <td className="text-right font-mono text-xs">
                {row.kc.toFixed(2)}
              </td>
              <td className="text-right font-mono font-bold">
                {row.kbw30 > 0 ? "+" : ""}
                {row.kbw30.toFixed(1)} mm
              </td>
              <td className="text-right font-mono text-xs font-semibold">
                {row.isCurrent ? (
                  <span className="text-gov-secondary">punkt odniesienia</span>
                ) : row.diffVsCurrentMm > 0 ? (
                  <span className="text-gov-success">
                    +{row.diffVsCurrentMm.toFixed(1)} mm (mniejszy deficyt)
                  </span>
                ) : row.diffVsCurrentMm < 0 ? (
                  <span className="text-gov-danger">
                    {row.diffVsCurrentMm.toFixed(1)} mm (większy deficyt)
                  </span>
                ) : (
                  <span className="text-gov-secondary">0.0 mm</span>
                )}
              </td>
              <td className={`text-right text-xs ${row.risk.badgeClass}`}>
                {row.risk.level}
              </td>
              <td className="text-right print:hidden">
                {!row.isCurrent ? (
                  <Link
                    href={`/raport?teryt=${encodeURIComponent(teryt)}&crop=${encodeURIComponent(row.crop.id)}&date=${encodeURIComponent(dateOnly)}`}
                    className="text-xs font-semibold text-gov-blue hover:underline whitespace-nowrap"
                  >
                    Przelicz raport →
                  </Link>
                ) : (
                  <span className="text-xs text-gov-muted">Aktywny</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
