"use client";

import React from "react";
import {
  DailyWeatherPoint,
  DecadeForecastPoint,
  Diagnosis,
  IrrigationRecommendation,
} from "@/types/analysis";
import { computeWeatherWindowSummary } from "@/lib/reportHelpers";

interface Step3IrrigationProps {
  irrigation?: IrrigationRecommendation | null;
  areaHa?: number | null;
  cropName?: string;
  forecastDecades?: DecadeForecastPoint[] | null;
  diagnosis?: Diagnosis;
  weatherSeries?: DailyWeatherPoint[];
  isArchive?: boolean;
}

export default function Step3Irrigation({
  irrigation,
  areaHa = 1.0,
  cropName = "uprawa",
  forecastDecades = [],
  diagnosis,
  weatherSeries = [],
  isArchive = false,
}: Step3IrrigationProps) {
  if (!irrigation) {
    return null;
  }

  const safeAreaHa =
    typeof areaHa === "number" && !isNaN(areaHa) && areaHa > 0 ? areaHa : 1.0;
  const safeDoseMm =
    typeof irrigation.dose_mm === "number" && !isNaN(irrigation.dose_mm)
      ? irrigation.dose_mm
      : 0.0;
  const safeDoseM3 =
    typeof irrigation.dose_m3_per_ha === "number" &&
    !isNaN(irrigation.dose_m3_per_ha)
      ? irrigation.dose_m3_per_ha
      : safeDoseMm * 10.0;
  const totalCubicMeters = Math.round(safeDoseM3 * safeAreaHa);

  const safeDecades = Array.isArray(forecastDecades) ? forecastDecades : [];
  const weatherWindowSummary = computeWeatherWindowSummary(
    irrigation,
    diagnosis,
    weatherSeries,
    isArchive
  );

  const total60dPrecip = Number(
    safeDecades
      .reduce(
        (acc, d) =>
          acc +
          (typeof d?.precipitation_mm === "number" && !isNaN(d.precipitation_mm)
            ? d.precipitation_mm
            : 0),
        0
      )
      .toFixed(1)
  );

  const total60dEtc = Number(
    safeDecades
      .reduce(
        (acc, d) =>
          acc +
          (typeof d?.etc_mm === "number" && !isNaN(d.etc_mm) ? d.etc_mm : 0),
        0
      )
      .toFixed(1)
  );

  return (
    <section className="pt-8 border-t-2 border-gov-navy space-y-6 print:pt-4 print:space-y-4">
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
          {irrigation.weather_window_status === "WSTRZYMAJ_OPADY" ? (
            <div className="p-4 bg-amber-50 border-l-4 border-amber-500 text-amber-900 rounded-r space-y-1">
              <div className="text-sm font-bold flex items-center gap-1.5">
                🌧️ Okno pogodowe: Wstrzymaj nawadnianie (prognozowany deszcz)
              </div>
              <p className="text-sm text-amber-800 leading-relaxed">
                {irrigation.justification ||
                  "W najbliższych dniach prognozowane są opady deszczu, które pokryją zapotrzebowanie uprawy."}
              </p>
            </div>
          ) : (
            <div className="gov-callout-info">
              <div className="text-sm font-bold text-gov-navy">
                Status: {irrigation.status || "Zalecane nawadnianie interwencyjne"}
              </div>
              <p className="text-sm text-gov-text mt-1 leading-relaxed">
                {irrigation.justification ||
                  "Zaleca się nawodnienie interwencyjne w celu ochrony plonu przed trwałym uwiądem."}
              </p>
            </div>
          )}

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
                  {safeDoseMm.toFixed(1)} mm{" "}
                  <span className="text-sm font-normal text-gov-secondary">
                    (odpowiada {safeDoseMm.toFixed(1)} litrom wody na 1 m²)
                  </span>
                </td>
              </tr>
              <tr>
                <td className="font-bold">Objętość wody na 1 hektar</td>
                <td className="font-mono font-bold text-gov-navy">
                  {Math.round(safeDoseM3)} m³ / ha
                </td>
              </tr>
              <tr>
                <td className="font-bold">
                  Całkowita objętość dla działki ({safeAreaHa} ha)
                </td>
                <td className="font-mono font-bold text-gov-blue">
                  {totalCubicMeters} m³ wody
                </td>
              </tr>
              <tr>
                <td className="font-bold">Rekomendowana technika</td>
                <td className="font-semibold text-gov-text">
                  {irrigation.recommended_technique ||
                    "Linie kroplujące lub deszczownia niskociśnieniowa"}
                </td>
              </tr>
              <tr>
                <td className="font-bold">Optymalna pora wykonania zabiegu</td>
                <td className="font-semibold text-gov-text">
                  {irrigation.recommended_timing ||
                    "Wyłącznie godziny wczesnoporanne lub nocne"}
                </td>
              </tr>
              <tr>
                <td className="font-bold">
                  Okno pogodowe (najbliższe 7 dni)
                </td>
                <td
                  className={`text-sm font-medium ${
                    weatherWindowSummary.tone === "warning"
                      ? "text-gov-warning font-semibold"
                      : "text-gov-text"
                  }`}
                >
                  {weatherWindowSummary.text}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="gov-callout-success">
            <div className="text-sm font-bold text-gov-navy">
              Status:{" "}
              {irrigation.status || "Nawadnianie nie jest obecnie konieczne"}
            </div>
            <p className="text-sm text-gov-text mt-1 leading-relaxed">
              {irrigation.justification ||
                "Bilans wodny gleby jest stabilny lub niedobór mieści się w granicach tolerancji roślin. Priorytetem pozostaje retencja glebowa i krajobrazowa z Etapu 2."}
            </p>
          </div>
          <div className="border border-gov-border bg-gov-surface/60 px-4 py-3 text-xs text-gov-text">
            <strong className="text-gov-navy">
              Okno pogodowe (najbliższe 7 dni):
            </strong>{" "}
            {weatherWindowSummary.text}
          </div>
        </div>
      )}

      {/* 3.1. Zestawienie dekadowe na 60 dni (prognoza lub weryfikacja ex-post) */}
      {safeDecades.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-base font-bold text-gov-navy">
              {isArchive
                ? "3.1. Weryfikacja ex-post potrzeb wodnych uprawy w kolejnych 60 dniach (6 dekad po badanej dacie)"
                : "3.1. Długoterminowa prognoza potrzeb wodnych uprawy na 60 dni (6 dekad po 10 dni)"}
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
              {safeDecades.map((dec, idx) => {
                const riskStatus = dec?.risk_status || "Stabilny";
                const isHighRisk = riskStatus.toLowerCase().includes("wysokie");
                const isMediumRisk = riskStatus.toLowerCase().includes("rosnący");
                const cropKc =
                  typeof dec?.crop_kc === "number" ? dec.crop_kc : 1.0;
                const precip =
                  typeof dec?.precipitation_mm === "number"
                    ? dec.precipitation_mm
                    : 0.0;
                const etc =
                  typeof dec?.etc_mm === "number" ? dec.etc_mm : 0.0;
                const kbwDec =
                  typeof dec?.kbw_decade_mm === "number"
                    ? dec.kbw_decade_mm
                    : 0.0;
                const kbw60d =
                  typeof dec?.kbw_60d_rolling_mm === "number"
                    ? dec.kbw_60d_rolling_mm
                    : 0.0;

                return (
                  <tr
                    key={dec?.decade_number ?? idx + 1}
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
                        {dec?.period_label || `Dekada ${idx + 1}`}
                      </div>
                      <div className="font-mono text-[11px] text-gov-secondary">
                        {dec?.start_date || "—"} – {dec?.end_date || "—"}
                      </div>
                    </td>
                    <td>
                      <div className="text-xs font-medium text-gov-text">
                        {dec?.growth_stage || "Faza wegetatywna"}
                      </div>
                      <div className="font-mono text-[11px] text-gov-secondary">
                        Kc = {cropKc.toFixed(2)}
                      </div>
                    </td>
                    <td className="text-right font-mono font-bold text-gov-blue">
                      +{precip.toFixed(1)} mm
                    </td>
                    <td className="text-right font-mono text-gov-secondary">
                      -{etc.toFixed(1)} mm
                    </td>
                    <td
                      className={`text-right font-mono font-bold ${
                        kbwDec < -15
                          ? "text-gov-danger"
                          : kbwDec < 0
                            ? "text-gov-warning"
                            : "text-gov-success"
                      }`}
                    >
                      {kbwDec > 0 ? "+" : ""}
                      {kbwDec.toFixed(1)} mm
                    </td>
                    <td className="text-right font-mono font-bold text-gov-navy">
                      {kbw60d > 0 ? "+" : ""}
                      {kbw60d.toFixed(1)} mm
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
                      {riskStatus}
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
