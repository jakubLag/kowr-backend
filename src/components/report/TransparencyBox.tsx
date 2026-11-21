"use client";

import React from "react";
import { ReportMetadata } from "@/types/analysis";

interface TransparencyBoxProps {
  metadata: ReportMetadata;
}

const DEFAULT_METHODOLOGICAL_LIMITATIONS = [
  "Brak lokalnych pomiarów poziomu zwierciadła wód gruntowych na działce (analiza oparta na bilansie powierzchniowym i strefie korzeniowej 0–30 cm).",
  "Parametry uziarnienia i pojemności wodnej gleby (ISRIC SoilGrids v2.0) są uśrednione dla siatki przestrzennej 250 × 250 m.",
  "Dane meteorologiczne (Open-Meteo / ERA5) odzwierciedlają warunki dla komórki modelu pogodowego i mogą nie uwzględniać lokalnych opadów burzowych o bardzo małym zasięgu.",
  "Wskaźniki satelitarne (Sentinel-2 L2A, rozdzielczość 10–20 m) obrazują stan łanu z dnia ostatniego bezchmurnego przelotu satelity.",
];

export default function TransparencyBox({ metadata }: TransparencyBoxProps) {
  const execSec = (metadata.execution_time_ms / 1000).toFixed(2);

  const combinedLimitations = [
    ...(metadata.limitations || []),
    ...DEFAULT_METHODOLOGICAL_LIMITATIONS,
  ];

  return (
    <section className="pt-8 border-t-2 border-gov-navy space-y-5 print:break-inside-avoid">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-gov-secondary mb-1">
            Metadane i dokładność
          </p>
          <h2 className="text-xl font-bold text-gov-navy">
            4. Źródła danych oraz ograniczenia analizy
          </h2>
        </div>
        <span className="text-xs text-gov-secondary tabular-nums">
          Czas wykonania obliczeń: <strong>{execSec} s</strong>
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-4">
          <h3 className="text-sm font-bold text-gov-navy">
            Wykorzystane rejestry i zbiory danych
          </h3>
          <table className="gov-table border border-gov-border tabular-nums">
            <thead>
              <tr>
                <th>Źródło danych</th>
                <th>Data aktualności</th>
              </tr>
            </thead>
            <tbody>
              {metadata.sources.map((src, idx) => (
                <tr key={idx}>
                  <td className="font-bold">{src}</td>
                  <td className="font-mono whitespace-nowrap">
                    {metadata.analysis_date}
                  </td>
                </tr>
              ))}
              {metadata.sentinel_scene_date && (
                <tr>
                  <td className="font-bold">
                    Scena satelitarna Sentinel-2{" "}
                    {metadata.cloud_cover_percent != null
                      ? `(zachmurzenie: ${metadata.cloud_cover_percent.toFixed(1)}%)`
                      : ""}
                  </td>
                  <td className="font-mono whitespace-nowrap">
                    {metadata.sentinel_scene_date}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="lg:col-span-5">
          <h3 className="text-sm font-bold text-gov-navy mb-2">
            Ograniczenia i niepewność analizy
          </h3>
          <div className="gov-callout-warning">
            <p className="text-xs text-gov-secondary mb-2.5 leading-relaxed">
              Analiza bazuje na publicznych danych satelitarnych i modelach
              meteorologicznych. Interpretując wyniki, należy uwzględnić:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-gov-text">
              {combinedLimitations.map((limitation, idx) => (
                <li key={idx} className="leading-relaxed">
                  {limitation}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
