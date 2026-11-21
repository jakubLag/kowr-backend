"use client";

import React from "react";
import {
  DecadeForecastPoint,
  IrrigationRecommendation,
} from "@/types/analysis";

interface Step3IrrigationProps {
  irrigation: IrrigationRecommendation;
  areaHa: number;
  cropName: string;
  forecastDecades: DecadeForecastPoint[];
}

export default function Step3Irrigation({
  irrigation,
  areaHa,
  cropName,
  forecastDecades,
}: Step3IrrigationProps) {
  const totalCubicMeters = Math.round(irrigation.dose_m3_per_ha * areaHa);

  const total60dPrecip = Number(
    forecastDecades
      .reduce((acc, d) => acc + d.precipitation_mm, 0)
      .toFixed(1)
  );
  const total60dEtc = Number(
    forecastDecades.reduce((acc, d) => acc + d.etc_mm, 0).toFixed(1)
  );

  return (
    <section className="pt-8 border-t-2 border-gov-navy space-y-6 print:break-inside-avoid">
      <div>
        <p className="text-xs font-bold text-gov-blue mb-1">
          Etap 3 z 3 — Zabieg uzupełniający i 60-dniowa prognoza potrzeb wodnych
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
                  {irrigation.dose_mm.toFixed(1)} mm{" "}
                  <span className="text-sm font-normal text-gov-secondary">
                    (odpowiada {irrigation.dose_mm.toFixed(1)} litrom wody na 1
                    m²)
                  </span>
                </td>
              </tr>
              <tr>
                <td className="font-bold">Objętość wody na 1 hektar</td>
                <td className="font-mono font-bold text-gov-navy">
                  {Math.round(irrigation.dose_m3_per_ha)} m³ / ha
                </td>
              </tr>
              <tr>
                <td className="font-bold">
                  Całkowita objętość dla działki ({areaHa} ha)
                </td>
                <td className="font-mono font-bold text-gov-blue">
                  {totalCubicMeters} m³ wody
                </td>
              </tr>
              <tr>
                <td className="font-bold">Rekomendowana technika</td>
                <td className="font-semibold text-gov-text">
                  {irrigation.recommended_technique}
                </td>
              </tr>
              <tr>
                <td className="font-bold">Optymalna pora wykonania zabiegu</td>
                <td className="font-semibold text-gov-text">
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

      {/* 3.1. Długoterminowa prognoza potrzeb wodnych na 60 dni (6 dekad po 10 dni) */}
      {forecastDecades.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-base font-bold text-gov-navy">
              3.1. Długoterminowa prognoza potrzeb wodnych uprawy na 60 dni (6
              dekad po 10 dni)
            </h3>
            <span className="text-xs font-semibold text-gov-secondary tabular-nums">
              Horyzont 60 dni — opad:{" "}
              <strong className="font-mono text-gov-blue">
                {total60dPrecip} mm
              </strong>{" "}
              vs pobór wody przez łan (ETc):{" "}
              <strong className="font-mono text-gov-navy">
                {total60dEtc} mm
              </strong>
            </span>
          </div>
          <p className="text-xs text-gov-secondary leading-relaxed">
            Zestawienie dekadowe (zgodne z metodyką IMGW i IUNG-PIB) pokazuje,
            jak w ciągu najbliższych 60 dni zmieni się zapotrzebowanie wodne
            uprawy wraz z przechodzeniem w kolejne fazy rozwojowe (Kc) oraz
            kiedy może wystąpić deficyt wymagający wcześniejszej retencji lub
            nawadniania.
          </p>

          <table className="gov-table border border-gov-border tabular-nums">
            <thead>
              <tr>
                <th>Okres (dekada 10-dniowa)</th>
                <th>Faza rozwojowa i Kc</th>
                <th className="text-right">Opad (P)</th>
                <th className="text-right">Pobór łanu (ETc)</th>
                <th className="text-right">Bilans dekady</th>
                <th className="text-right">Kroczące KBW (60d)</th>
                <th>Ocena ryzyka w dekadzie</th>
              </tr>
            </thead>
            <tbody>
              {forecastDecades.map((dec) => {
                const isHighRisk = dec.risk_status
                  .toLowerCase()
                  .includes("wysokie");
                const isMediumRisk = dec.risk_status
                  .toLowerCase()
                  .includes("rosnący");

                return (
                  <tr
                    key={dec.decade_number}
                    className={
                      isHighRisk
                        ? "bg-gov-danger-bg/40"
                        : isMediumRisk
                          ? "bg-gov-warning-bg/40"
                          : "bg-white"
                    }
                  >
                    <td>
                      <div className="font-bold text-gov-navy text-xs">
                        {dec.period_label}
                      </div>
                      <div className="font-mono text-[11px] text-gov-secondary">
                        {dec.start_date} – {dec.end_date}
                      </div>
                    </td>
                    <td>
                      <div className="text-xs font-medium text-gov-text">
                        {dec.growth_stage}
                      </div>
                      <div className="font-mono text-[11px] text-gov-secondary">
                        Kc = {dec.crop_kc.toFixed(2)}
                      </div>
                    </td>
                    <td className="text-right font-mono font-bold text-gov-blue">
                      +{dec.precipitation_mm.toFixed(1)} mm
                    </td>
                    <td className="text-right font-mono text-gov-secondary">
                      -{dec.etc_mm.toFixed(1)} mm
                    </td>
                    <td
                      className={`text-right font-mono font-bold ${
                        dec.kbw_decade_mm < -15
                          ? "text-gov-danger"
                          : dec.kbw_decade_mm < 0
                            ? "text-gov-warning"
                            : "text-gov-success"
                      }`}
                    >
                      {dec.kbw_decade_mm > 0 ? "+" : ""}
                      {dec.kbw_decade_mm.toFixed(1)} mm
                    </td>
                    <td className="text-right font-mono font-bold text-gov-navy">
                      {dec.kbw_60d_rolling_mm > 0 ? "+" : ""}
                      {dec.kbw_60d_rolling_mm.toFixed(1)} mm
                    </td>
                    <td
                      className={`text-xs font-semibold ${
                        isHighRisk
                          ? "text-gov-danger"
                          : isMediumRisk
                            ? "text-gov-warning"
                            : "text-gov-success"
                      }`}
                    >
                      {dec.risk_status}
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
