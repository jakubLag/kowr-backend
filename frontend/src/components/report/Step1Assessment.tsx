"use client";

import React from "react";
import dynamic from "next/dynamic";
import {
  DailyWeatherPoint,
  DecadeForecastPoint,
  Diagnosis,
  ParcelSearchResponse,
} from "@/types/analysis";
import { getCriticalThresholdForSoil } from "@/lib/retentionSimulator";
import {
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
  ReferenceArea,
  ReferenceLine,
} from "recharts";

const ReportHydroMap = dynamic(
  () => import("@/components/report/ReportHydroMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 w-full border border-gov-border bg-gov-surface flex items-center justify-center text-xs text-gov-secondary">
        Wczytywanie szkicu hydrologicznego działki...
      </div>
    ),
  }
);

interface Step1AssessmentProps {
  diagnosis: Diagnosis;
  parcelInfo?: ParcelSearchResponse | null;
  cropName: string;
  kcCoefficient: number;
  weatherSeries: DailyWeatherPoint[];
  forecastDecades: DecadeForecastPoint[];
  targetDate?: string;
  isArchive?: boolean;
}

function getRiskDetails(level: string, isWaterlogged: boolean) {
  const normalized = level.toUpperCase();
  if (isWaterlogged || normalized.includes("NADMIAR")) {
    return {
      label:
        "Nadmierne uwilgotnienie gleby (ryzyko zastoisk wodnych i niedotlenienia korzeni)",
      calloutClass: "gov-callout-warning",
      statusTextClass: "text-gov-warning font-bold",
    };
  }
  if (normalized === "WYSOKIE" || normalized === "HIGH") {
    return {
      label: "Wysokie zagrożenie suszą rolniczą",
      calloutClass: "gov-callout-danger",
      statusTextClass: "text-gov-danger font-bold",
    };
  }
  if (normalized === "UMIARKOWANE" || normalized === "MEDIUM") {
    return {
      label: "Umiarkowane zagrożenie suszą",
      calloutClass: "gov-callout-warning",
      statusTextClass: "text-gov-warning font-bold",
    };
  }
  return {
    label: "Niskie zagrożenie suszą (optymalne uwodnienie)",
    calloutClass: "gov-callout-success",
    statusTextClass: "text-gov-success font-bold",
  };
}

export default function Step1Assessment({
  diagnosis,
  parcelInfo,
  cropName,
  kcCoefficient,
  weatherSeries,
  forecastDecades,
  targetDate,
  isArchive = false,
}: Step1AssessmentProps) {
  const isWaterlogged =
    diagnosis.drought_risk_level.toUpperCase().includes("NADMIAR") ||
    diagnosis.kbw_30d_mm > Math.max(35, diagnosis.awc_mm * 0.85) ||
    diagnosis.kbw_60d_mm > Math.max(60, diagnosis.awc_mm * 1.4);

  const risk = getRiskDetails(diagnosis.drought_risk_level, isWaterlogged);
  const critThreshold =
    diagnosis.critical_threshold_kbw_60d_mm ??
    getCriticalThresholdForSoil(diagnosis.soil_category);

  // Odfiltrowujemy merytorycznie błędne zdanie z backendu (mały spadek nie jest przyczyną niedoboru wody)
  const sanitizedCauses = diagnosis.primary_causes.filter(
    (c) => !c.toLowerCase().includes("rowy nie wpływają na nawodnienie")
  );

  const effectiveCauses =
    isWaterlogged &&
    !sanitizedCauses.some((c) => c.toLowerCase().includes("nadwyżka"))
      ? [
          `Nadwyżka opadów nad parowaniem (KBW 30d: +${diagnosis.kbw_30d_mm.toFixed(1)} mm, KBW 60d: +${diagnosis.kbw_60d_mm.toFixed(1)} mm) przekracza pojemność wodną warstwy ornej (AWC: ${diagnosis.awc_mm.toFixed(1)} mm) — ryzyko zastoisk wodnych i niedotlenienia strefy korzeniowej.`,
          ...sanitizedCauses.filter(
            (c) => !c.toLowerCase().includes("w granicach normy")
          ),
        ]
      : sanitizedCauses.length > 0
        ? sanitizedCauses
        : ["Warunki wodne i wilgotnościowe w granicach normy."];

  const summaryBarData = [
    {
      label: "Bilans wodny (30 dni)",
      value: diagnosis.kbw_30d_mm,
      color:
        diagnosis.kbw_30d_mm < -50
          ? "#C81E1E"
          : diagnosis.kbw_30d_mm < 0
            ? "#B45309"
            : "#156534",
    },
    {
      label: "Bilans wodny (60 dni)",
      value: diagnosis.kbw_60d_mm,
      color:
        diagnosis.kbw_60d_mm < -80
          ? "#C81E1E"
          : diagnosis.kbw_60d_mm < 0
            ? "#B45309"
            : "#156534",
    },
  ];

  const formatDayMonth = (iso: string) => {
    const parts = iso.split("-");
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}`;
    }
    return iso;
  };

  const timeSeriesChartData = weatherSeries.map((pt) => {
    const kind =
      pt.forecast_kind ||
      (!pt.is_forecast
        ? "historical"
        : isArchive
          ? "ex_post"
          : "climatology");
    const typeLabel =
      kind === "historical"
        ? "Historia (Open-Meteo)"
        : kind === "synoptic_16d"
          ? "Prognoza synoptyczna (16 dni, Open-Meteo)"
          : kind === "ex_post"
            ? "Przebieg po badanej dacie (weryfikacja ex-post)"
            : "Scenariusz klimatologiczny (dni +17..+60)";
    return {
      ...pt,
      forecast_kind: kind,
      shortDate: formatDayMonth(pt.date), // DD.MM
      typeLabel,
    };
  });

  const lastHistoricalPoint = timeSeriesChartData
    .filter((p) => !p.is_forecast)
    .slice(-1)[0];

  const forecastPoints = timeSeriesChartData.filter((p) => p.is_forecast);
  const synopticPoints = forecastPoints.filter(
    (p) => p.forecast_kind === "synoptic_16d"
  );
  const climatologyPoints = forecastPoints.filter(
    (p) => p.forecast_kind === "climatology"
  );
  const firstForecastPoint = forecastPoints[0];
  const lastForecastPoint = forecastPoints[forecastPoints.length - 1];
  const firstSynopticPoint = synopticPoints[0];
  const lastSynopticPoint = synopticPoints[synopticPoints.length - 1];
  const firstClimatologyPoint = climatologyPoints[0];
  const lastClimatologyPoint = climatologyPoints[climatologyPoints.length - 1];
  const forecast60dPrecipSum =
    diagnosis.forecast_60d_precip_mm != null
      ? diagnosis.forecast_60d_precip_mm
      : Number(
          forecastPoints
            .reduce((acc, p) => acc + p.precipitation_mm, 0)
            .toFixed(1)
        );

  const forecast60dKbwEnd =
    forecastDecades.length > 0
      ? forecastDecades[forecastDecades.length - 1].kbw_60d_rolling_mm
      : forecastPoints.length > 0
        ? forecastPoints[forecastPoints.length - 1].kbw_cumulative_mm
        : diagnosis.kbw_60d_mm;

  return (
    <section className="pt-8 border-t-2 border-gov-navy space-y-6 print:pt-4 print:space-y-4">
      <div>
        <p className="text-xs font-bold text-gov-blue mb-1">
          Etap 1 z 3 — Diagnoza sytuacji wodnej
        </p>
        <h2 className="text-xl sm:text-2xl font-bold text-gov-navy">
          1. Ocena sytuacji wodnej i przyczyny niedoboru wody ({cropName})
        </h2>
      </div>

      {/* Komunikat statusu ryzyka */}
      <div className={risk.calloutClass}>
        <div className="text-sm font-bold text-gov-navy">
          Ocena stanu uwilgotnienia:{" "}
          <span className={risk.statusTextClass}>{risk.label}</span>
        </div>
        <p className="text-sm text-gov-text mt-1 leading-relaxed">
          Status bilansu wodnego:{" "}
          <strong>
            {isWaterlogged
              ? `Przesycenie profilu glebowego wodą (nadwyżka +${diagnosis.kbw_30d_mm.toFixed(1)} mm przekracza pojemność AWC ${diagnosis.awc_mm.toFixed(1)} mm)`
              : diagnosis.kbw_status}
          </strong>{" "}
          (przyjęty współczynnik zapotrzebowania uprawy Kc:{" "}
          <span className="font-mono font-semibold">
            {kcCoefficient.toFixed(2)}
          </span>
          ).
        </p>
      </div>

      {/* 1.1 Klimatyczny Bilans Wodny (30 i 60 dni) */}
      <div className="space-y-3">
        <h3 className="text-base font-bold text-gov-navy">
          1.1. Klimatyczny Bilans Wodny (30 i 60 dni)
        </h3>
        <p className="text-sm text-gov-secondary leading-relaxed">
          Różnica między sumą opadów a parowaniem terenowym. Wartość ujemna
          oznacza deficyt wody na polu — każdy <strong>-1 mm</strong> to brak{" "}
          <strong>1 litra wody na 1 m²</strong>.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-12 print:block print:space-y-3 gap-6 items-start pt-2">
          <div className="lg:col-span-6">
            <table className="gov-table border border-gov-border tabular-nums">
              <thead>
                <tr>
                  <th>Okres bilansu</th>
                  <th className="text-right">Bilans (KBW)</th>
                  <th className="text-right">Przeliczenie na 1 m²</th>
                </tr>
              </thead>
              <tbody>
                {diagnosis.precipitation_30d_mm != null &&
                  diagnosis.et0_30d_mm != null && (
                    <tr>
                      <td className="font-medium">
                        Opady i parowanie ET0 (30 dni)
                      </td>
                      <td className="text-right font-mono text-xs">
                        opad: <strong>{diagnosis.precipitation_30d_mm.toFixed(1)} mm</strong>
                      </td>
                      <td className="text-right font-mono text-xs text-gov-secondary">
                        ET0: {diagnosis.et0_30d_mm.toFixed(1)} mm (ETc:{" "}
                        {(diagnosis.et0_30d_mm * kcCoefficient).toFixed(1)} mm)
                      </td>
                    </tr>
                  )}
                <tr>
                  <td className="font-medium">Ostatnie 30 dni (bilans KBW)</td>
                  <td
                    className={`text-right font-mono font-bold ${
                      diagnosis.kbw_30d_mm < -50
                        ? "text-gov-danger"
                        : diagnosis.kbw_30d_mm < 0
                          ? "text-gov-warning"
                          : "text-gov-success"
                    }`}
                  >
                    {diagnosis.kbw_30d_mm > 0 ? "+" : ""}
                    {diagnosis.kbw_30d_mm.toFixed(1)} mm
                  </td>
                  <td className="text-right font-mono text-gov-secondary">
                    {diagnosis.kbw_30d_mm < 0
                      ? `brakuje ${Math.abs(diagnosis.kbw_30d_mm).toFixed(1)} l/m²`
                      : `nadwyżka ${diagnosis.kbw_30d_mm.toFixed(1)} l/m²`}
                  </td>
                </tr>
                <tr>
                  <td className="font-medium">Ostatnie 60 dni (historia)</td>
                  <td
                    className={`text-right font-mono font-bold ${
                      diagnosis.kbw_60d_mm < -80
                        ? "text-gov-danger"
                        : diagnosis.kbw_60d_mm < 0
                          ? "text-gov-warning"
                          : "text-gov-success"
                    }`}
                  >
                    {diagnosis.kbw_60d_mm > 0 ? "+" : ""}
                    {diagnosis.kbw_60d_mm.toFixed(1)} mm
                  </td>
                  <td className="text-right font-mono text-gov-secondary">
                    {diagnosis.kbw_60d_mm < 0
                      ? `brakuje ${Math.abs(diagnosis.kbw_60d_mm).toFixed(1)} l/m²`
                      : `nadwyżka ${diagnosis.kbw_60d_mm.toFixed(1)} l/m²`}
                  </td>
                </tr>
                <tr>
                  <td className="font-medium">
                    Próg krytyczny suszy IUNG-PIB (gleba: {diagnosis.soil_category})
                  </td>
                  <td className="text-right font-mono font-bold text-gov-danger">
                    {critThreshold.toFixed(1)} mm
                  </td>
                  <td className="text-right font-mono text-xs text-gov-secondary">
                    kryterium 60-dniowego KBW
                  </td>
                </tr>
                <tr className="bg-gov-surface">
                  <td className="font-bold text-gov-navy">
                    {isArchive
                      ? "Weryfikacja ex-post (+60 dni po badanej dacie)"
                      : "Horyzont +60 dni (prognoza 16d + scenariusz klimatologiczny)"}
                  </td>
                  <td className="text-right font-mono font-bold text-gov-blue">
                    opad 60d: +{forecast60dPrecipSum.toFixed(1)} mm
                  </td>
                  <td className="text-right font-mono font-semibold text-gov-navy">
                    KBW (60d): {forecast60dKbwEnd > 0 ? "+" : ""}
                    {forecast60dKbwEnd.toFixed(1)} mm
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="lg:col-span-6 border border-gov-border p-4 bg-white print:p-3 print:break-inside-avoid">
            <div className="text-xs font-bold text-gov-secondary mb-2">
              Zestawienie 30-dniowego i 60-dniowego bilansu wodnego [mm]
            </div>
            <div className="w-full h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={summaryBarData}
                  layout="vertical"
                  margin={{ top: 6, right: 64, left: 10, bottom: 6 }}
                >
                  <CartesianGrid
                    strokeDasharray="2 2"
                    horizontal={false}
                    stroke="#D2D6DC"
                  />
                  <XAxis
                    type="number"
                    unit=" mm"
                    tick={{ fontSize: 11, fill: "#4A5568" }}
                  />
                  <YAxis
                    dataKey="label"
                    type="category"
                    width={155}
                    tick={{ fontSize: 12, fill: "#1B1B1B", fontWeight: 600 }}
                  />
                  <ReferenceLine x={0} stroke="#0B2240" />
                  <Tooltip
                    formatter={(value: number) => [
                      `${value} mm`,
                      "Bilans (KBW)",
                    ]}
                    contentStyle={{
                      borderRadius: "2px",
                      border: "1px solid #D2D6DC",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 1, 1, 0]} barSize={22}>
                    {summaryBarData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                    <LabelList
                      dataKey="value"
                      position="right"
                      formatter={(val: number) => `${val} mm`}
                      style={{
                        fill: "#1B1B1B",
                        fontWeight: 700,
                        fontSize: "12px",
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* 1.2 Przebieg bilansu w czasie: historia + 60 dni prognozy / weryfikacji ex-post */}
      <div className="space-y-3 pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-bold text-gov-navy">
            {isArchive
              ? `1.2. Przebieg bilansu wodnego do dnia ${targetDate || "badania"} i weryfikacja ex-post (+60 dni)`
              : "1.2. Przebieg bilansu wodnego: Historia → Prognoza 16 dni → Scenariusz klimatologiczny"}
          </h3>
          <div className="flex flex-wrap items-center gap-4 text-xs text-gov-secondary">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 bg-[#0052A5]" />
              <span>Opady historyczne [mm]</span>
            </span>
            {!isArchive && synopticPoints.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 bg-[#0284C7]" />
                <span>Prognoza synoptyczna (16 dni)</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 bg-[#94A3B8]" />
              <span>
                {isArchive
                  ? "Przebieg ex-post (+60 dni)"
                  : "Scenariusz klimatologiczny (+17..+60 dni)"}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-4 h-0.5 bg-[#C81E1E]" />
              <span>Kroczący bilans 60-dniowy KBW [mm]</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-4 h-0.5 border-b-2 border-dashed border-[#7F1D1D]" />
              <span>Próg suszy IUNG ({critThreshold} mm)</span>
            </span>
          </div>
        </div>
        <p className="text-sm text-gov-secondary leading-relaxed">
          {isArchive ? (
            <>
              Analiza dotyczy daty historycznej (
              <strong className="font-mono">{targetDate}</strong>). Lewa część
              wykresu przedstawia bilans wodny do badanego dnia, natomiast
              zacieniowana strefa po prawej stronie stanowi wyłącznie{" "}
              <strong>
                historyczny przebieg po badanej dacie (weryfikacja ex-post)
              </strong>{" "}
              i nie jest prognozą pogody.
            </>
          ) : (
            <>
              Wykres rozróżnia trzy strefy: <strong>Historię (Open-Meteo)</strong>{" "}
              po lewej stronie, <strong>Prognozę synoptyczną (dni +1..+16)</strong>{" "}
              w strefie niebieskiej oraz{" "}
              <strong>Scenariusz klimatologiczny (dni +17..+60)</strong> w
              strefie szarej (oparty o sezonowe normy opadowo-parowaniowe i
              zmieniający się współczynnik uprawy Kc).
            </>
          )}
        </p>

        <div className="border border-gov-border p-4 bg-white print:p-3 print:break-inside-avoid">
          <div className="w-full h-64 print:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={timeSeriesChartData}
                margin={{ top: 24, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="2 2" stroke="#D2D6DC" />
                <XAxis
                  dataKey="shortDate"
                  tick={{ fontSize: 11, fill: "#4A5568" }}
                  minTickGap={22}
                />
                <YAxis
                  yAxisId="kbw"
                  orientation="left"
                  width={58}
                  unit=" mm"
                  tick={{ fontSize: 11, fill: "#1B1B1B" }}
                />
                <YAxis
                  yAxisId="precip"
                  orientation="right"
                  width={50}
                  unit=" mm"
                  domain={[
                    0,
                    (dataMax: number) =>
                      Math.max(20, Math.ceil((dataMax || 0) * 1.2)),
                  ]}
                  tick={{ fontSize: 11, fill: "#0052A5" }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === "kbw_cumulative_mm") {
                      return [`${value} mm`, "Kroczący bilans 60-dniowy KBW"];
                    }
                    if (name === "precipitation_mm") {
                      return [`${value} mm`, "Opad dobowy"];
                    }
                    return [`${value} mm`, name];
                  }}
                  labelFormatter={(label, payload) => {
                    const item = payload?.[0]?.payload;
                    if (!item) return `Data: ${label}`;
                    return `${item.date} — ${item.typeLabel} (ET0: ${item.et0_mm} mm)`;
                  }}
                  contentStyle={{
                    borderRadius: "2px",
                    border: "1px solid #D2D6DC",
                    fontSize: "12px",
                  }}
                />
                <ReferenceLine
                  yAxisId="kbw"
                  y={0}
                  stroke="#64707D"
                  strokeDasharray="3 3"
                />
                <ReferenceLine
                  yAxisId="kbw"
                  y={critThreshold}
                  stroke="#7F1D1D"
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  label={{
                    value: `Próg suszy IUNG (${critThreshold} mm)`,
                    position: "insideBottomLeft",
                    fill: "#7F1D1D",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                />
                {isArchive ? (
                  firstForecastPoint &&
                  lastForecastPoint && (
                    <ReferenceArea
                      yAxisId="kbw"
                      x1={firstForecastPoint.shortDate}
                      x2={lastForecastPoint.shortDate}
                      fill="#64748B"
                      fillOpacity={0.1}
                    />
                  )
                ) : (
                  <>
                    {firstSynopticPoint && lastSynopticPoint && (
                      <ReferenceArea
                        yAxisId="kbw"
                        x1={firstSynopticPoint.shortDate}
                        x2={lastSynopticPoint.shortDate}
                        fill="#0284C7"
                        fillOpacity={0.11}
                      />
                    )}
                    {firstClimatologyPoint && lastClimatologyPoint && (
                      <ReferenceArea
                        yAxisId="kbw"
                        x1={firstClimatologyPoint.shortDate}
                        x2={lastClimatologyPoint.shortDate}
                        fill="#94A3B8"
                        fillOpacity={0.12}
                      />
                    )}
                    {lastSynopticPoint && firstClimatologyPoint && (
                      <ReferenceLine
                        yAxisId="kbw"
                        x={lastSynopticPoint.shortDate}
                        stroke="#64748B"
                        strokeWidth={1.5}
                        strokeDasharray="3 3"
                        label={{
                          value: "Scenariusz klimatologiczny →",
                          position: "insideTopRight",
                          fill: "#475569",
                          fontSize: 10,
                          fontWeight: 600,
                        }}
                      />
                    )}
                  </>
                )}
                {lastHistoricalPoint && (
                  <ReferenceLine
                    yAxisId="kbw"
                    x={lastHistoricalPoint.shortDate}
                    stroke="#0B2240"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    label={{
                      value: isArchive
                        ? "Weryfikacja ex-post (+60d) →"
                        : synopticPoints.length > 0
                          ? "Prognoza 16d →"
                          : "Scenariusz +60d →",
                      position: "top",
                      fill: "#0B2240",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  />
                )}
                <Bar
                  yAxisId="precip"
                  dataKey="precipitation_mm"
                  barSize={6}
                >
                  {timeSeriesChartData.map((entry, idx) => (
                    <Cell
                      key={`pcell-${idx}`}
                      fill={
                        entry.forecast_kind === "historical"
                          ? "#0052A5"
                          : entry.forecast_kind === "synoptic_16d"
                            ? "#0284C7"
                            : "#94A3B8"
                      }
                    />
                  ))}
                </Bar>
                <Line
                  yAxisId="kbw"
                  type="monotone"
                  dataKey="kbw_cumulative_mm"
                  stroke="#C81E1E"
                  strokeWidth={2.5}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 1.3 Kondycja uprawy z satelity */}
      <div className="space-y-3 pt-4 print:pt-2 print:break-inside-avoid">
        <h3 className="text-base font-bold text-gov-navy">
          1.3. Kondycja i uwodnienie roślin (dane satelitarne Sentinel-2)
        </h3>
        <table className="gov-table border border-gov-border tabular-nums">
          <thead>
            <tr>
              <th>Badany wskaźnik</th>
              <th>Znaczenie dla uprawy</th>
              <th className="text-right">Stan obecny</th>
              <th className="text-right">Norma referencyjna uprawy (faza)</th>
              <th className="text-right">Odchylenie</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-bold">
                Kondycja i zieloność łanu
                <span className="block text-xs font-normal text-gov-secondary">
                  Wskaźnik wegetacji (NDVI)
                </span>
              </td>
              <td className="text-gov-secondary">
                Określa gęstość roślin i wigor wzrostu uprawy.
              </td>
              <td className="text-right font-mono font-bold">
                {diagnosis.ndvi_current != null
                  ? diagnosis.ndvi_current.toFixed(2)
                  : "Brak danych"}
              </td>
              <td className="text-right font-mono text-gov-secondary">
                {diagnosis.ndvi_historical_median != null
                  ? diagnosis.ndvi_historical_median.toFixed(2)
                  : "—"}
              </td>
              <td className="text-right font-mono font-bold">
                {diagnosis.ndvi_anomaly_percent != null ? (
                  <span
                    className={
                      diagnosis.ndvi_anomaly_percent < -10
                        ? "text-gov-danger"
                        : diagnosis.ndvi_anomaly_percent < 0
                          ? "text-gov-warning"
                          : "text-gov-success"
                    }
                  >
                    {diagnosis.ndvi_anomaly_percent > 0
                      ? `+${diagnosis.ndvi_anomaly_percent.toFixed(1)}%`
                      : `${diagnosis.ndvi_anomaly_percent.toFixed(1)}%`}
                  </span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
            <tr>
              <td className="font-bold">
                Uwodnienie roślin
                <span className="block text-xs font-normal text-gov-secondary">
                  Wskaźnik wilgotności (NDMI)
                </span>
              </td>
              <td className="text-gov-secondary">
                Wskazuje zawartość wody w liściach i początki stresu wodnego.
              </td>
              <td className="text-right font-mono font-bold">
                {diagnosis.ndmi_current != null
                  ? diagnosis.ndmi_current.toFixed(2)
                  : "Brak danych"}
              </td>
              <td className="text-right font-mono text-gov-secondary">—</td>
              <td className="text-right font-mono text-gov-secondary">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 1.4 Właściwości gleby i terenu */}
      <div className="space-y-3 pt-4">
        <h3 className="text-base font-bold text-gov-navy">
          1.4. Gleba, nachylenie terenu i sieć melioracyjna
        </h3>
        <table className="gov-table border border-gov-border tabular-nums">
          <thead>
            <tr>
              <th className="w-1/3">Parametr działki</th>
              <th className="w-1/4">Wartość</th>
              <th>Opis agronomiczny</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-bold">Kategoria i uziarnienie gleby</td>
              <td className="font-semibold">
                {diagnosis.soil_category} ({diagnosis.soil_texture})
              </td>
              <td className="text-gov-secondary">
                Polowa Pojemność Wodna (AWC) do 30 cm:{" "}
                <strong className="font-mono text-gov-text">
                  {diagnosis.awc_mm.toFixed(1)} mm
                </strong>
                .
              </td>
            </tr>
            <tr>
              <td className="font-bold">Średni spadek terenu</td>
              <td className="font-mono font-bold">
                {diagnosis.slope_percent != null
                  ? `${diagnosis.slope_percent.toFixed(1)}%`
                  : "Brak danych"}
                {diagnosis.aspect_direction && (
                  <span className="block font-sans text-xs font-normal text-gov-secondary">
                    spływ: {diagnosis.aspect_direction}
                  </span>
                )}
              </td>
              <td className="text-gov-secondary">
                {diagnosis.slope_percent == null
                  ? "Brak danych wysokościowych DEM dla oceny nachylenia stoku."
                  : diagnosis.slope_percent >= 3
                    ? "Podwyższone ryzyko spływu powierzchniowego wody po stoku podczas ulew."
                    : "Niewielki spadek terenu sprzyja wsiąkaniu wody opadowej."}
              </td>
            </tr>
            <tr>
              <td className="font-bold">
                Odległość do najbliższego rowu / cieku
              </td>
              <td className="font-mono font-bold">
                {diagnosis.distance_to_ditch_m != null
                  ? `${Math.round(diagnosis.distance_to_ditch_m)} m`
                  : "Brak w buforze 500 m"}
                {diagnosis.nearest_waterway_type && (
                  <span className="block font-sans text-xs font-normal text-gov-secondary">
                    typ: {diagnosis.nearest_waterway_type}
                  </span>
                )}
              </td>
              <td className="text-gov-secondary">
                {diagnosis.distance_to_ditch_m != null
                  ? "Bliskość rowu melioracyjnego stwarza możliwość spowolnienia odpływu wody."
                  : "W bezpośrednim sąsiedztwie działki nie wykryto rowów melioracyjnych."}
              </td>
            </tr>
            {diagnosis.nearest_river && (
              <tr>
                <td className="font-bold">
                  Najbliższa rzeka i stan wody
                  <span className="block text-xs font-normal text-gov-secondary">
                    Stacja hydrologiczna IMGW-PIB
                  </span>
                </td>
                <td className="font-semibold text-gov-navy">
                  rzeka {diagnosis.nearest_river}
                  {diagnosis.water_level_cm != null && (
                    <span className="block font-mono text-xs text-gov-secondary font-normal">
                      stan wody: {diagnosis.water_level_cm} cm
                    </span>
                  )}
                </td>
                <td className="text-gov-secondary">
                  {diagnosis.river_distance_m != null
                    ? `Stacja wodowskazowa IMGW w odległości ${(diagnosis.river_distance_m / 1000).toFixed(1)} km od działki.`
                    : "Lokalna sieć zlewniowa IMGW-PIB."}
                </td>
              </tr>
            )}
            {(diagnosis.has_wetland_or_pond_nearby != null ||
              diagnosis.has_windbreak_nearby != null) && (
              <tr>
                <td className="font-bold">
                  Elementy krajobrazowe i retencja naturalna (OSM)
                </td>
                <td className="text-xs font-semibold space-y-1">
                  {diagnosis.has_wetland_or_pond_nearby != null && (
                    <div>
                      Oczka / mokradła (500 m):{" "}
                      <span
                        className={
                          diagnosis.has_wetland_or_pond_nearby
                            ? "text-gov-success font-bold"
                            : "text-gov-secondary"
                        }
                      >
                        {diagnosis.has_wetland_or_pond_nearby
                          ? "wykryto"
                          : "brak"}
                      </span>
                    </div>
                  )}
                  {diagnosis.has_windbreak_nearby != null && (
                    <div>
                      Zadrzewienia / żywopłoty (300 m):{" "}
                      <span
                        className={
                          diagnosis.has_windbreak_nearby
                            ? "text-gov-success font-bold"
                            : "text-gov-warning font-bold"
                        }
                      >
                        {diagnosis.has_windbreak_nearby
                          ? "wykryto"
                          : "brak"}
                      </span>
                    </div>
                  )}
                </td>
                <td className="text-gov-secondary">
                  {diagnosis.has_wetland_or_pond_nearby
                    ? "Oczka wodne i mokradła w otoczeniu stabilizują lokalny bilans wodny — warto chronić ich strefę buforową. "
                    : ""}
                  {diagnosis.has_windbreak_nearby === false
                    ? "Brak zadrzewień śródpolnych w promieniu 300 m zwiększa parowanie powodowane przez wiatr."
                    : diagnosis.has_windbreak_nearby === true
                      ? "Obecność zadrzewień śródpolnych ogranicza wiatr i parowanie z pola."
                      : ""}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {parcelInfo && (
          <div className="pt-2 print:hidden">
            <ReportHydroMap parcel={parcelInfo} diagnosis={diagnosis} />
          </div>
        )}
      </div>

      {/* 1.5 Główne przyczyny niedoboru lub nadmiaru wody */}
      {effectiveCauses.length > 0 && (
        <div className="space-y-3 pt-4 print:pt-2 print:break-inside-avoid">
          <h3 className="text-base font-bold text-gov-navy">
            1.5.{" "}
            {isWaterlogged
              ? "Zidentyfikowane przyczyny nadmiernego uwilgotnienia działki"
              : "Główne przyczyny niedoboru wody na działce"}
          </h3>
          <div className="gov-callout-warning">
            <ol className="list-decimal list-inside space-y-2 text-sm text-gov-text">
              {effectiveCauses.map((cause, idx) => (
                <li key={idx} className="leading-relaxed">
                  <span className="font-medium">{cause}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}
