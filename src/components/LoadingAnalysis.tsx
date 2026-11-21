"use client";

import React, { useEffect, useState } from "react";

interface LoadingAnalysisProps {
  teryt: string;
  cropLabel: string;
  analysisDate: string;
  onSkipDemo?: () => void;
}

const LOADING_STEPS = [
  {
    step: 1,
    title: "Lokalizuję działkę...",
    detail:
      "Pobieranie granic ewidencyjnych oraz obliczanie nachylenia terenu z Numerycznego Modelu Terenu (NMT).",
  },
  {
    step: 2,
    title: "Pobieram opady z ostatnich 10 lat...",
    detail:
      "Zestawienie danych o opadach i parowaniu z archiwum meteorologicznego Open-Meteo (2016–2026).",
  },
  {
    step: 3,
    title: "Analizuję zdjęcia satelitarne...",
    detail:
      "Obliczanie wskaźników kondycji roślin (NDVI) oraz uwodnienia łanu (NDMI) ze zdjęć satelitarnych Sentinel-2.",
  },
  {
    step: 4,
    title: "Badam pojemność wodną gleby i sieć rowów...",
    detail:
      "Łączenie danych glebowych ISRIC SoilGrids (siatka 250 m) z mapą rowów i cieków wodnych w promieniu 300 m.",
  },
  {
    step: 5,
    title: "Generuję rekomendacje...",
    detail:
      "Przygotowanie oceny ryzyka suszy, priorytetowych zaleceń retencyjnych oraz wytycznych nawadniania.",
  },
];

export default function LoadingAnalysis({
  teryt,
  cropLabel,
  analysisDate,
  onSkipDemo,
}: LoadingAnalysisProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(10);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setStepIndex((prev) =>
        prev < LOADING_STEPS.length - 1 ? prev + 1 : prev
      );
    }, 3000);

    const progressInterval = setInterval(() => {
      setProgress((prev) => (prev >= 96 ? 96 : prev + 2));
    }, 250);

    const secInterval = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
      clearInterval(secInterval);
    };
  }, []);

  return (
    <section
      aria-live="polite"
      className="max-w-3xl py-4 space-y-6"
    >
      <div className="border-b border-gov-border pb-4">
        <p className="text-xs font-bold text-gov-blue mb-1">
          Trwa generowanie raportu (szacowany czas: 10–25 sekund)
        </p>
        <h1 className="text-2xl font-bold text-gov-navy">
          {LOADING_STEPS[stepIndex].title}
        </h1>
        <p className="text-sm text-gov-secondary mt-1">
          Działka ewidencyjna:{" "}
          <strong className="font-mono text-gov-text">{teryt}</strong> • Uprawa:{" "}
          <strong className="text-gov-text">{cropLabel}</strong> • Data
          analizy: <strong className="font-mono text-gov-text">{analysisDate}</strong>
        </p>
      </div>

      {/* Pasek postępu */}
      <div>
        <div className="flex items-center justify-between text-xs text-gov-secondary mb-1.5 tabular-nums">
          <span>Postęp przetwarzania danych</span>
          <span className="font-bold text-gov-text">
            {progress}% (czas: {elapsedSec} s)
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          className="w-full h-3 bg-gov-surface border border-gov-border overflow-hidden"
        >
          <div
            className="h-full bg-gov-blue transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Tabela etapów */}
      <table className="gov-table border border-gov-border">
        <thead>
          <tr>
            <th className="w-16">Etap</th>
            <th>Wykonywana operacja</th>
            <th className="w-36 text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {LOADING_STEPS.map((item, idx) => {
            const isDone = idx < stepIndex;
            const isCurrent = idx === stepIndex;

            return (
              <tr
                key={item.step}
                className={
                  isCurrent
                    ? "bg-gov-blue-light"
                    : isDone
                      ? "bg-white"
                      : "bg-gov-surface/40 text-gov-muted"
                }
              >
                <td className="font-mono font-bold tabular-nums">
                  {item.step} / {LOADING_STEPS.length}
                </td>
                <td>
                  <div className="font-bold text-gov-text">{item.title}</div>
                  <div className="text-xs text-gov-secondary mt-0.5">
                    {item.detail}
                  </div>
                </td>
                <td className="text-right font-semibold text-xs whitespace-nowrap">
                  {isDone ? (
                    <span className="text-gov-success">Zakończono</span>
                  ) : isCurrent ? (
                    <span className="text-gov-blue">W trakcie...</span>
                  ) : (
                    <span className="text-gov-muted">Oczekuje</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {onSkipDemo && (
        <div className="pt-2 flex items-center justify-between gap-4">
          <span className="text-xs text-gov-secondary">
            W trybie demonstracyjnym możesz pominąć czas oczekiwania na odpowiedź
            modeli satelitarnych.
          </span>
          <button
            type="button"
            onClick={onSkipDemo}
            className="gov-btn-secondary text-xs py-2 px-3.5 shrink-0"
          >
            Wyświetl raport natychmiast
          </button>
        </div>
      )}
    </section>
  );
}
