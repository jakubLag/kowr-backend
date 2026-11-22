"use client";

import React from "react";
import { DataSourceMeta, Diagnosis, ReportMetadata } from "@/types/analysis";
import { computeAnalysisConfidence } from "@/lib/reportHelpers";

interface TransparencyBoxProps {
  metadata: ReportMetadata;
  diagnosis?: Diagnosis;
  targetDate?: string;
}

const DEFAULT_METHODOLOGICAL_LIMITATIONS = [
  "Brak lokalnych pomiarów poziomu zwierciadła wód gruntowych na działce (analiza oparta na bilansie powierzchniowym i strefie korzeniowej 0–30 cm).",
  "Parametry uziarnienia i pojemności wodnej gleby (ISRIC SoilGrids v2.0) są uśrednione dla siatki przestrzennej 250 × 250 m.",
  "Dane meteorologiczne (Open-Meteo / ERA5) odzwierciedlają warunki dla komórki modelu pogodowego i mogą nie uwzględniać lokalnych opadów burzowych o bardzo małym zasięgu.",
  "Wskaźniki satelitarne (Sentinel-2 L2A, rozdzielczość 10–20 m) obrazują stan łanu z dnia ostatniego bezchmurnego przelotu satelity.",
];

function inferSourceMeta(
  sourceName: string,
  freshnessDate: string,
  sentinelDate?: string | null
): DataSourceMeta {
  const lower = sourceName.toLowerCase();
  if (lower.includes("uldk") || lower.includes("gugik")) {
    return {
      name: sourceName,
      fetched_mode: "live",
      data_freshness: freshnessDate,
      spatial_resolution: "Granice działek EGiB",
      license: "Dane publiczne GUGiK (otwarte)",
    };
  }
  if (lower.includes("open-meteo") || lower.includes("era5")) {
    return {
      name: sourceName,
      fetched_mode: "live",
      data_freshness: freshnessDate,
      spatial_resolution: "~9–11 km (ERA5 / IFS)",
      license: "CC BY 4.0 (niekomercyjne)",
    };
  }
  if (lower.includes("sentinel") || lower.includes("copernicus")) {
    return {
      name: sourceName,
      fetched_mode: sentinelDate ? "live" : "unavailable",
      data_freshness: sentinelDate || "brak bezchmurnej sceny",
      spatial_resolution: "10–20 m (L2A)",
      license: "Copernicus Open Access",
    };
  }
  if (lower.includes("soilgrids") || lower.includes("isric")) {
    return {
      name: sourceName,
      fetched_mode: "live",
      data_freshness: "ISRIC v2.0 (model globalny)",
      spatial_resolution: "250 × 250 m",
      license: "CC BY 4.0",
    };
  }
  if (lower.includes("overpass") || lower.includes("openstreetmap") || lower.includes("osm")) {
    return {
      name: sourceName,
      fetched_mode: "live",
      data_freshness: freshnessDate,
      spatial_resolution: "Wektorowe (bufor 500 m)",
      license: "ODbL (OpenStreetMap)",
    };
  }
  if (lower.includes("nmt") || lower.includes("dem") || lower.includes("elevation")) {
    return {
      name: sourceName,
      fetched_mode: "live",
      data_freshness: "Model wysokościowy",
      spatial_resolution: "~1–30 m",
      license: "Dane otwarte / CC BY 4.0",
    };
  }
  if (lower.includes("fao") || lower.includes("iung") || lower.includes("saxton")) {
    return {
      name: sourceName,
      fetched_mode: "static",
      data_freshness: "Parametry metodyczne",
      spatial_resolution: "Model punktowy",
      license: "Literatura naukowa / publiczne",
    };
  }
  return {
    name: sourceName,
    fetched_mode: "live",
    data_freshness: freshnessDate,
    spatial_resolution: "—",
    license: "Otwarte dane",
  };
}

function formatFetchedMode(mode: string): { label: string; className: string } {
  const m = mode.toLowerCase();
  if (m === "live") {
    return {
      label: "Na żywo",
      className: "bg-gov-success-bg text-gov-success border-gov-success/30",
    };
  }
  if (m === "cached") {
    return {
      label: "Cache",
      className: "bg-gov-blue-light text-gov-blue border-gov-blue/30",
    };
  }
  if (m === "static") {
    return {
      label: "Statyczne",
      className: "bg-gov-surface text-gov-secondary border-gov-border",
    };
  }
  return {
    label: "Niedostępne",
    className: "bg-gov-warning-bg text-gov-warning border-gov-warning/30",
  };
}

export default function TransparencyBox({
  metadata,
  diagnosis,
  targetDate,
}: TransparencyBoxProps) {
  const execSec = (metadata.execution_time_ms / 1000).toFixed(2);
  const freshnessFallback = targetDate || metadata.analysis_date;

  const combinedLimitations = [
    ...(metadata.limitations || []),
    ...DEFAULT_METHODOLOGICAL_LIMITATIONS,
  ];

  // Wyznaczenie poziomu pewności analizy (z backendu lub deterministycznie na froncie)
  const confidence = computeAnalysisConfidence(metadata, diagnosis);

  const confidenceCalloutClass =
    confidence.level === "WYSOKA"
      ? "gov-callout-success"
      : confidence.level === "ŚREDNIA"
        ? "gov-callout-info"
        : "gov-callout-warning";

  const confidenceTextClass =
    confidence.level === "WYSOKA"
      ? "text-gov-success"
      : confidence.level === "ŚREDNIA"
        ? "text-gov-blue"
        : "text-gov-warning";

  const resolvedDataSources: DataSourceMeta[] =
    Array.isArray(metadata.data_sources) && metadata.data_sources.length > 0
      ? metadata.data_sources
      : [
          ...metadata.sources.map((src) =>
            inferSourceMeta(src, freshnessFallback, metadata.sentinel_scene_date)
          ),
          ...(metadata.sentinel_scene_date &&
          !metadata.sources.some((s) => s.toLowerCase().includes("sentinel"))
            ? [
                {
                  name: `Scena satelitarna Sentinel-2${
                    metadata.cloud_cover_percent != null
                      ? ` (zachmurzenie: ${metadata.cloud_cover_percent.toFixed(1)}%)`
                      : ""
                  }`,
                  fetched_mode: "live",
                  data_freshness: metadata.sentinel_scene_date,
                  spatial_resolution: "10–20 m (L2A)",
                  license: "Copernicus Open Access",
                },
              ]
            : []),
        ];

  return (
    <section className="pt-8 border-t-2 border-gov-navy space-y-5 print:break-inside-avoid">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-gov-secondary mb-1">
            Metadane, wiarygodność i dokładność
          </p>
          <h2 className="text-xl font-bold text-gov-navy">
            4. Poziom pewności, źródła danych oraz ograniczenia analizy
          </h2>
        </div>
        <span className="text-xs text-gov-secondary tabular-nums">
          Czas wykonania obliczeń: <strong>{execSec} s</strong>
        </span>
      </div>

      {/* Blok poziomu pewności analizy */}
      <div className={confidenceCalloutClass}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-bold text-gov-navy">
            Poziom pewności analizy:{" "}
            <span className={confidenceTextClass}>{confidence.level}</span>{" "}
            <span className="font-mono">({confidence.score}%)</span>
          </div>
          {metadata.sentinel_scene_date && (
            <span className="text-xs font-mono text-gov-secondary">
              Scena Sentinel-2: {metadata.sentinel_scene_date}
              {metadata.cloud_cover_percent != null
                ? ` • zachmurzenie: ${metadata.cloud_cover_percent.toFixed(1)}%`
                : ""}
            </span>
          )}
        </div>
        <p className="text-xs sm:text-sm text-gov-text mt-1 leading-relaxed">
          {confidence.explanation}
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-gov-navy">
            Wykorzystane rejestry i zbiory danych
          </h3>
          <div className="overflow-x-auto">
            <table className="gov-table border border-gov-border tabular-nums text-xs">
              <thead>
                <tr>
                  <th>Źródło danych</th>
                  <th>Tryb</th>
                  <th>Aktualność</th>
                  <th className="hidden sm:table-cell">Rozdzielczość</th>
                  <th className="hidden md:table-cell">Licencja</th>
                </tr>
              </thead>
              <tbody>
                {resolvedDataSources.map((src, idx) => {
                  const mode = formatFetchedMode(src.fetched_mode);
                  return (
                    <tr key={idx}>
                      <td className="font-bold text-gov-navy">{src.name}</td>
                      <td className="whitespace-nowrap">
                        <span
                          className={`inline-block px-1.5 py-0.5 text-[10px] font-bold border rounded-[2px] ${mode.className}`}
                        >
                          {mode.label}
                        </span>
                      </td>
                      <td className="font-mono whitespace-nowrap">
                        {src.data_freshness}
                      </td>
                      <td className="hidden sm:table-cell text-gov-secondary">
                        {src.spatial_resolution || "—"}
                      </td>
                      <td className="hidden md:table-cell text-gov-secondary">
                        {src.license || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-gov-navy mb-2">
            Ograniczenia i niepewność analizy
          </h3>
          <div className="gov-callout-warning">
            <p className="text-xs text-gov-secondary mb-2.5 leading-relaxed">
              Analiza bazuje na publicznych danych satelitarnych i modelach
              meteorologicznych. Interpretując wyniki, należy uwzględnić:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-xs text-gov-text">
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
