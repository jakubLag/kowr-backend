"use client";

import React from "react";
import { DailyWeatherPoint, Diagnosis } from "@/types/analysis";
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
  ReferenceLine,
} from "recharts";

interface Step1AssessmentProps {
  diagnosis: Diagnosis;
  cropName: string;
  kcCoefficient: number;
  weatherSeries: DailyWeatherPoint[];
}

function getRiskDetails(level: string) {
  const normalized = level.toUpperCase();
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
    label: "Niskie zagrożenie suszą (dobre uwodnienie)",
    calloutClass: "gov-callout-success",
    statusTextClass: "text-gov-success font-bold",
  };
}

export default function Step1Assessment({
  diagnosis,
  cropName,
  kcCoefficient,
  weatherSeries,
}: Step1AssessmentProps) {
  const risk = getRiskDetails(diagnosis.drought_risk_level);

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

  const timeSeriesChartData = weatherSeries.map((pt) => ({
    ...pt,
    shortDate: pt.date.slice(5), // MM-DD
    typeLabel: pt.is_forecast ? "Prognoza (7 dni)" : "Historia (30 dni)",
  }));

  const lastHistoricalPoint = weatherSeries
    .filter((p) => !p.is_forecast)
    .slice(-1)[0];

  const forecastPoints = weatherSeries.filter((p) => p.is_forecast);
  const forecastPrecipSum =
    diagnosis.forecast_7d_precip_mm != null
      ? diagnosis.forecast_7d_precip_mm
      : Number(
          forecastPoints
            .reduce((acc, p) => acc + p.precipitation_mm, 0)
            .toFixed(1)
        );

  const forecastKbwEnd =
    forecastPoints.length > 0
      ? forecastPoints[forecastPoints.length - 1].kbw_cumulative_mm
      : diagnosis.kbw_30d_mm;

  return (
    <section className="pt-8 border-t-2 border-gov-navy space-y-6 print:break-inside-avoid">
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
          Poziom ryzyka: <span className={risk.statusTextClass}>{risk.label}</span>
        </div>
        <p className="text-sm text-gov-text mt-1 leading-relaxed">
          Status bilansu wodnego: <strong>{diagnosis.kbw_status}</strong>{" "}
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-2">
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
                <tr>
                  <td className="font-medium">Ostatnie 30 dni (historia)</td>
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
                <tr className="bg-gov-surface">
                  <td className="font-bold text-gov-navy">
                    Prognoza na kolejne 7 dni (Open-Meteo)
                  </td>
                  <td className="text-right font-mono font-bold text-gov-blue">
                    opad: +{forecastPrecipSum.toFixed(1)} mm
                  </td>
                  <td className="text-right font-mono font-semibold text-gov-navy">
                    KBW za 7 dni: {forecastKbwEnd > 0 ? "+" : ""}
                    {forecastKbwEnd.toFixed(1)} mm
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="lg:col-span-6 border border-gov-border p-4 bg-white">
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

      {/* 1.2 Przebieg bilansu w czasie: 30 dni historii + 7 dni prognozy */}
      <div className="space-y-3 pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-bold text-gov-navy">
            1.2. Przebieg bilansu wodnego dzień po dniu (30 dni historii + 7 dni
            prognozy)
          </h3>
          <div className="flex flex-wrap items-center gap-4 text-xs text-gov-secondary">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 bg-[#0052A5]" />
              <span>Opady dobowe [mm]</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-4 h-0.5 bg-[#C81E1E]" />
              <span>Skumulowany bilans KBW [mm]</span>
            </span>
          </div>
        </div>
        <p className="text-sm text-gov-secondary leading-relaxed">
          Czerwona linia pokazuje narastający deficyt wody w ostatnich 30 dniach
          oraz prognozowany trend na najbliższe 7 dni (po prawej stronie linii
          przerywanej).
        </p>

        <div className="border border-gov-border p-4 bg-white">
          <div className="w-full h-60">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={timeSeriesChartData}
                margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="2 2" stroke="#D2D6DC" />
                <XAxis
                  dataKey="shortDate"
                  tick={{ fontSize: 11, fill: "#4A5568" }}
                  interval={2}
                />
                <YAxis
                  yAxisId="kbw"
                  orientation="left"
                  unit=" mm"
                  tick={{ fontSize: 11, fill: "#1B1B1B" }}
                />
                <YAxis
                  yAxisId="precip"
                  orientation="right"
                  unit=" mm"
                  domain={[0, 35]}
                  tick={{ fontSize: 11, fill: "#0052A5" }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === "kbw_cumulative_mm") {
                      return [`${value} mm`, "Skumulowany bilans KBW"];
                    }
                    if (name === "precipitation_mm") {
                      return [`${value} mm`, "Opad dobowy"];
                    }
                    return [`${value} mm`, name];
                  }}
                  labelFormatter={(label, payload) => {
                    const item = payload?.[0]?.payload;
                    if (!item) return `Data: ${label}`;
                    return `${item.date} — ${
                      item.is_forecast ? "PROGNOZA 7-DNIOWA" : "Pomiar historyczny"
                    } (ET0: ${item.et0_mm} mm)`;
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
                {lastHistoricalPoint && (
                  <ReferenceLine
                    yAxisId="kbw"
                    x={lastHistoricalPoint.date.slice(5)}
                    stroke="#0B2240"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    label={{
                      value: "Dzisiaj → Prognoza 7d",
                      position: "insideTopLeft",
                      fill: "#0B2240",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  />
                )}
                <Bar
                  yAxisId="precip"
                  dataKey="precipitation_mm"
                  fill="#0052A5"
                  barSize={10}
                />
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
      <div className="space-y-3 pt-4">
        <h3 className="text-base font-bold text-gov-navy">
          1.3. Kondycja i uwodnienie roślin (dane satelitarne Sentinel-2)
        </h3>
        <table className="gov-table border border-gov-border tabular-nums">
          <thead>
            <tr>
              <th>Badany wskaźnik</th>
              <th>Znaczenie dla uprawy</th>
              <th className="text-right">Stan obecny</th>
              <th className="text-right">Norma wieloletnia</th>
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
                {diagnosis.slope_percent.toFixed(1)}%
              </td>
              <td className="text-gov-secondary">
                {diagnosis.slope_percent >= 3
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
              </td>
              <td className="text-gov-secondary">
                {diagnosis.distance_to_ditch_m != null
                  ? "Bliskość rowu melioracyjnego stwarza możliwość spowolnienia odpływu wody."
                  : "W bezpośrednim sąsiedztwie działki nie wykryto rowów melioracyjnych."}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 1.5 Główne przyczyny niedoboru wody */}
      {diagnosis.primary_causes.length > 0 && (
        <div className="space-y-3 pt-4">
          <h3 className="text-base font-bold text-gov-navy">
            1.5. Główne przyczyny niedoboru wody na działce
          </h3>
          <div className="gov-callout-warning">
            <ol className="list-decimal list-inside space-y-2 text-sm text-gov-text">
              {diagnosis.primary_causes.map((cause, idx) => (
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
