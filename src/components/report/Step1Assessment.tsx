"use client";

import React from "react";
import { RiskLevel, Step1WaterAssessment } from "@/types/analysis";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";

interface Step1AssessmentProps {
  assessment: Step1WaterAssessment;
  cropName: string;
}

function getRiskDetails(level: RiskLevel) {
  switch (level) {
    case "HIGH":
      return {
        label: "Wysokie zagrożenie suszą rolniczą",
        description:
          "Stwierdzono znaczny niedobór wody w strefie korzeniowej oraz osłabienie kondycji roślin względem normy wieloletniej.",
        calloutClass: "gov-callout-danger",
        statusTextClass: "text-gov-danger font-bold",
      };
    case "MEDIUM":
      return {
        label: "Umiarkowane zagrożenie suszą",
        description:
          "Parowanie przewyższa sumę opadów z ostatnich 30 dni. Rośliny korzystają z zapasów wody zgromadzonych w glebie.",
        calloutClass: "gov-callout-warning",
        statusTextClass: "text-gov-warning font-bold",
      };
    case "LOW":
      return {
        label: "Niskie zagrożenie suszą (dobre uwodnienie)",
        description:
          "Zapas wilgoci w glebie oraz kondycja uprawy mieszczą się w normie wieloletniej dla tego okresu.",
        calloutClass: "gov-callout-success",
        statusTextClass: "text-gov-success font-bold",
      };
  }
}

function getSoilRetentionDescription(capacity: RiskLevel) {
  switch (capacity) {
    case "LOW":
      return {
        label: "Niska (gleba lekka, przepuszczalna)",
        detail:
          "Woda opadowa szybko przesiąka poniżej strefy korzeniowej; gleba słabo magazynuje wilgoć.",
      };
    case "MEDIUM":
      return {
        label: "Średnia (gleba średniozwięzła)",
        detail:
          "Umiarkowana zdolność zatrzymywania wody opadowej w warstwie ornej.",
      };
    case "HIGH":
      return {
        label: "Wysoka (gleba zwięzła, zasobna w próchnicę)",
        detail:
          "Gleba dobrze magazynuje wodę opadową i stopniowo oddaje ją roślinom w okresach bezdeszczowych.",
      };
  }
}

export default function Step1Assessment({
  assessment,
  cropName,
}: Step1AssessmentProps) {
  const risk = getRiskDetails(assessment.drought_risk_level);
  const soil = getSoilRetentionDescription(assessment.soil_retention_capacity);

  const chartData = [
    {
      label: "Opady deszczu (30 dni)",
      value: assessment.precipitation_30d_mm,
      color: "#0052A5",
    },
    {
      label: "Parowanie z pola (30 dni)",
      value: assessment.evapotranspiration_30d_mm,
      color: "#B45309",
    },
  ];

  const ndviDiffPercent =
    assessment.ndvi_10y_median > 0
      ? Math.round(
          ((assessment.ndvi_current - assessment.ndvi_10y_median) /
            assessment.ndvi_10y_median) *
            100
        )
      : 0;

  const ndmiDiffPercent =
    assessment.ndmi_10y_median > 0
      ? Math.round(
          ((assessment.ndmi_current - assessment.ndmi_10y_median) /
            assessment.ndmi_10y_median) *
            100
        )
      : 0;

  const missingLitersPerSqM = Math.abs(
    Math.round(assessment.climatic_water_balance_mm * 10) / 10
  );

  return (
    <section className="pt-8 border-t-2 border-gov-navy space-y-6 print:break-inside-avoid">
      {/* Nagłówek Etapu 1 */}
      <div>
        <p className="text-xs font-bold text-gov-blue mb-1">
          Etap 1 z 3 — Diagnoza sytuacji wodnej
        </p>
        <h2 className="text-xl sm:text-2xl font-bold text-gov-navy">
          1. Ocena sytuacji wodnej i przyczyny niedoboru wody ({cropName})
        </h2>
      </div>

      {/* Komunikat statusu ryzyka w stylu gov.pl */}
      <div className={risk.calloutClass}>
        <div className="text-sm font-bold text-gov-navy">
          Poziom ryzyka: <span className={risk.statusTextClass}>{risk.label}</span>
        </div>
        <p className="text-sm text-gov-text mt-1 leading-relaxed">
          {risk.description}
        </p>
      </div>

      {/* 1.1 Bilans wodny (Tabela + wykres) */}
      <div className="space-y-3">
        <h3 className="text-base font-bold text-gov-navy">
          1.1. Bilans wodny z ostatnich 30 dni (opady a parowanie)
        </h3>
        <p className="text-sm text-gov-secondary leading-relaxed">
          Porównanie ilości wody, która spadła z deszczem, z ilością wody
          utraconej przez parowanie z gleby i roślin. Każdy{" "}
          <strong>1 mm</strong> oznacza <strong>1 litr wody na 1 m² pola</strong>.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-2">
          {/* Tabela liczbowa bilansu */}
          <div className="lg:col-span-6">
            <table className="gov-table border border-gov-border tabular-nums">
              <thead>
                <tr>
                  <th>Składowa bilansu (ostatnie 30 dni)</th>
                  <th className="text-right">Wartość</th>
                  <th className="text-right">Przeliczenie na 1 m²</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-medium">Przychód wody (opady deszczu)</td>
                  <td className="text-right font-mono font-bold">
                    {assessment.precipitation_30d_mm.toFixed(1)} mm
                  </td>
                  <td className="text-right font-mono text-gov-secondary">
                    +{assessment.precipitation_30d_mm.toFixed(1)} l/m²
                  </td>
                </tr>
                <tr>
                  <td className="font-medium">
                    Utrata wody (parowanie gleby i roślin)
                  </td>
                  <td className="text-right font-mono font-bold">
                    {assessment.evapotranspiration_30d_mm.toFixed(1)} mm
                  </td>
                  <td className="text-right font-mono text-gov-secondary">
                    -{assessment.evapotranspiration_30d_mm.toFixed(1)} l/m²
                  </td>
                </tr>
                <tr className="bg-gov-surface">
                  <td className="font-bold text-gov-navy">
                    Klimatyczny bilans wodny (saldo)
                  </td>
                  <td className="text-right font-mono font-bold text-gov-danger">
                    {assessment.climatic_water_balance_mm > 0 ? "+" : ""}
                    {assessment.climatic_water_balance_mm.toFixed(1)} mm
                  </td>
                  <td className="text-right font-mono font-bold text-gov-danger">
                    brakuje {missingLitersPerSqM} l/m²
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Wykres słupkowy */}
          <div className="lg:col-span-6 border border-gov-border p-4 bg-white">
            <div className="text-xs font-bold text-gov-secondary mb-2">
              Porównanie opadów i parowania [mm]
            </div>
            <div className="w-full h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
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
                    width={165}
                    tick={{ fontSize: 12, fill: "#1B1B1B", fontWeight: 600 }}
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      `${value} mm (${value} l/m²)`,
                      "Ilość wody",
                    ]}
                    contentStyle={{
                      borderRadius: "2px",
                      border: "1px solid #D2D6DC",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 1, 1, 0]} barSize={22}>
                    {chartData.map((entry, index) => (
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

      {/* 1.2 Kondycja upraw i uwodnienie z satelity */}
      <div className="space-y-3 pt-4">
        <h3 className="text-base font-bold text-gov-navy">
          1.2. Kondycja uprawy i zawartość wody w roślinach (dane satelitarne)
        </h3>
        <p className="text-sm text-gov-secondary leading-relaxed">
          Zestawienie aktualnych pomiarów satelitarnych ze średnią wieloletnią
          (normą z ostatnich 10 lat) dla badanej działki o tej samej porze roku.
        </p>

        <table className="gov-table border border-gov-border tabular-nums">
          <thead>
            <tr>
              <th>Badany wskaźnik</th>
              <th>Co oznacza dla rolnika</th>
              <th className="text-right">Stan obecny</th>
              <th className="text-right">Norma z 10 lat</th>
              <th className="text-right">Różnica</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-bold">
                Kondycja i zieloność roślin
                <span className="block text-xs font-normal text-gov-secondary">
                  Wskaźnik wegetacji (NDVI)
                </span>
              </td>
              <td className="text-gov-secondary">
                Określa gęstość łanu i wigor wzrostu części nadziemnych roślin.
              </td>
              <td className="text-right font-mono font-bold">
                {assessment.ndvi_current.toFixed(2)}
              </td>
              <td className="text-right font-mono text-gov-secondary">
                {assessment.ndvi_10y_median.toFixed(2)}
              </td>
              <td className="text-right font-mono font-bold">
                <span
                  className={
                    ndviDiffPercent < -10
                      ? "text-gov-danger"
                      : ndviDiffPercent < 0
                        ? "text-gov-warning"
                        : "text-gov-success"
                  }
                >
                  {ndviDiffPercent > 0
                    ? `+${ndviDiffPercent}%`
                    : `${ndviDiffPercent}%`}
                </span>
              </td>
            </tr>
            <tr>
              <td className="font-bold">
                Uwodnienie liści i łanu
                <span className="block text-xs font-normal text-gov-secondary">
                  Wskaźnik wilgotności (NDMI)
                </span>
              </td>
              <td className="text-gov-secondary">
                Pokazuje zawartość wody w tkankach roślin; spadek oznacza stres
                wodny i więdnięcie.
              </td>
              <td className="text-right font-mono font-bold">
                {assessment.ndmi_current.toFixed(2)}
              </td>
              <td className="text-right font-mono text-gov-secondary">
                {assessment.ndmi_10y_median.toFixed(2)}
              </td>
              <td className="text-right font-mono font-bold">
                <span
                  className={
                    ndmiDiffPercent < -20
                      ? "text-gov-danger"
                      : ndmiDiffPercent < 0
                        ? "text-gov-warning"
                        : "text-gov-success"
                  }
                >
                  {ndmiDiffPercent > 0
                    ? `+${ndmiDiffPercent}%`
                    : `${ndmiDiffPercent}%`}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 1.3 Warunki glebowe i terenowe */}
      <div className="space-y-3 pt-4">
        <h3 className="text-base font-bold text-gov-navy">
          1.3. Właściwości gleby, ukształtowanie terenu i sieć rowów
        </h3>

        <table className="gov-table border border-gov-border tabular-nums">
          <thead>
            <tr>
              <th className="w-1/3">Czynnik środowiskowy</th>
              <th className="w-1/4">Wartość na działce</th>
              <th>Wpływ na gospodarkę wodną pola</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-bold">Zdolność gleby do zatrzymywania wody</td>
              <td className="font-semibold">{soil.label}</td>
              <td className="text-gov-secondary">{soil.detail}</td>
            </tr>
            <tr>
              <td className="font-bold">Nachylenie terenu (spadek pola)</td>
              <td className="font-mono font-bold">{assessment.slope_percent}%</td>
              <td className="text-gov-secondary">
                {assessment.slope_percent >= 3
                  ? "Podwyższone ryzyko spływu powierzchniowego wody po stoku podczas ulewnych opadów."
                  : "Niewielki spadek terenu sprzyja wsiąkaniu wody opadowej na polu."}
              </td>
            </tr>
            <tr>
              <td className="font-bold">
                Rowy i cieki wodne w sąsiedztwie (do 300 m)
              </td>
              <td className="font-mono font-bold">
                {assessment.nearby_waterways_count}{" "}
                {assessment.nearby_waterways_count === 1 ? "obiekt" : "obiekty"}
              </td>
              <td className="text-gov-secondary">
                {assessment.nearby_waterways_count > 0
                  ? "Obecność rowów w sąsiedztwie pozwala na spowolnienie odpływu wody (np. przez zastosowanie zastawki)."
                  : "Brak rowów melioracyjnych w bezpośrednim sąsiedztwie działki."}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 1.4 Zidentyfikowane przyczyny niedoboru wody */}
      <div className="space-y-3 pt-4">
        <h3 className="text-base font-bold text-gov-navy">
          1.4. Główne przyczyny niedoboru wody na działce
        </h3>
        <div className="gov-callout-warning">
          <ol className="list-decimal list-inside space-y-2 text-sm text-gov-text">
            {assessment.identified_causes.map((cause, idx) => (
              <li key={idx} className="leading-relaxed">
                <span className="font-medium">{cause}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
