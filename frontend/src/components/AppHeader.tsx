"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface AppHeaderProps {
  currentStep: 1 | 2 | 3;
  teryt?: string | null;
  crop?: string | null;
  date?: string | null;
}

export default function AppHeader({
  currentStep,
  teryt,
  crop,
  date,
}: AppHeaderProps) {
  const step1Href = teryt ? `/?teryt=${encodeURIComponent(teryt)}` : "/";
  const step2Href = teryt
    ? `/parametry?teryt=${encodeURIComponent(teryt)}${crop ? `&crop=${encodeURIComponent(crop)}` : ""}${date ? `&date=${encodeURIComponent(date)}` : ""}`
    : null;
  const step3Href =
    teryt && crop && date
      ? `/raport?teryt=${encodeURIComponent(teryt)}&crop=${encodeURIComponent(crop)}&date=${encodeURIComponent(date)}`
      : null;

  return (
    <header className="bg-white border-b border-gov-border print:hidden">
      {/* Pasek instytucji (KOWR) oraz ścieżka powrotu (Breadcrumbs) */}
      <div className="bg-gov-surface border-b border-gov-border">
        <div className="gov-container py-3 flex flex-col gap-1.5">
          <nav
            aria-label="Ścieżka nawigacji"
            className="flex flex-wrap items-center gap-1.5 text-xs text-gov-secondary"
          >
            <Link
              href="/"
              className="text-gov-blue hover:underline font-normal"
            >
              Strona główna
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-gov-muted shrink-0" />
            <Link
              href="/"
              className="text-gov-blue hover:underline font-normal"
            >
              Krajowy Ośrodek Wsparcia Rolnictwa
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-gov-muted shrink-0" />
            <span className="text-gov-text font-medium">
              Wsparcie gospodarowania wodą w rolnictwie
            </span>
          </nav>

          <div className="flex flex-wrap items-baseline justify-between gap-2 pt-0.5">
            <div className="text-base sm:text-lg font-bold text-gov-navy">
              Zatrzymaj wodę, chroń plony — System doradztwa wodnego dla
              rolników
            </div>
            {teryt && (
              <div className="text-xs text-gov-secondary">
                Wybrana działka:{" "}
                <strong className="font-mono text-gov-text">{teryt}</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pasek kroków e-usługi */}
      <div className="bg-white">
        <div className="gov-container">
          <nav aria-label="Kroki usługi" className="-mb-px">
            <ol className="flex flex-wrap items-center gap-6 sm:gap-10 text-sm">
              {/* Krok 1 */}
              <li>
                <Link
                  href={step1Href}
                  aria-current={currentStep === 1 ? "step" : undefined}
                  className={`inline-flex items-center gap-2.5 py-3.5 border-b-[3px] transition-colors ${
                    currentStep === 1
                      ? "border-gov-blue text-gov-blue font-bold"
                      : "border-transparent text-gov-secondary hover:text-gov-text hover:border-gov-border"
                  }`}
                >
                  <span
                    className={`w-6 h-6 text-xs font-bold flex items-center justify-center rounded-[2px] ${
                      currentStep === 1
                        ? "bg-gov-blue text-white"
                        : "bg-gov-surface text-gov-text border border-gov-border"
                    }`}
                  >
                    1
                  </span>
                  <span>Wyszukanie działki (TERYT)</span>
                </Link>
              </li>

              {/* Krok 2 */}
              <li>
                {step2Href ? (
                  <Link
                    href={step2Href}
                    aria-current={currentStep === 2 ? "step" : undefined}
                    className={`inline-flex items-center gap-2.5 py-3.5 border-b-[3px] transition-colors ${
                      currentStep === 2
                        ? "border-gov-blue text-gov-blue font-bold"
                        : "border-transparent text-gov-secondary hover:text-gov-text hover:border-gov-border"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 text-xs font-bold flex items-center justify-center rounded-[2px] ${
                        currentStep === 2
                          ? "bg-gov-blue text-white"
                          : "bg-gov-surface text-gov-text border border-gov-border"
                      }`}
                    >
                      2
                    </span>
                    <span>Wybór uprawy i daty</span>
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-2.5 py-3.5 border-b-[3px] border-transparent text-gov-muted cursor-not-allowed">
                    <span className="w-6 h-6 text-xs font-bold flex items-center justify-center rounded-[2px] bg-gov-surface text-gov-muted border border-gov-border">
                      2
                    </span>
                    <span>Wybór uprawy i daty</span>
                  </span>
                )}
              </li>

              {/* Krok 3 */}
              <li>
                {step3Href ? (
                  <Link
                    href={step3Href}
                    aria-current={currentStep === 3 ? "step" : undefined}
                    className={`inline-flex items-center gap-2.5 py-3.5 border-b-[3px] transition-colors ${
                      currentStep === 3
                        ? "border-gov-blue text-gov-blue font-bold"
                        : "border-transparent text-gov-secondary hover:text-gov-text hover:border-gov-border"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 text-xs font-bold flex items-center justify-center rounded-[2px] ${
                        currentStep === 3
                          ? "bg-gov-blue text-white"
                          : "bg-gov-surface text-gov-text border border-gov-border"
                      }`}
                    >
                      3
                    </span>
                    <span>Raport i zalecenia</span>
                  </Link>
                ) : (
                  <span
                    className={`inline-flex items-center gap-2.5 py-3.5 border-b-[3px] ${
                      currentStep === 3
                        ? "border-gov-blue text-gov-blue font-bold"
                        : "border-transparent text-gov-muted cursor-not-allowed"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 text-xs font-bold flex items-center justify-center rounded-[2px] ${
                        currentStep === 3
                          ? "bg-gov-blue text-white"
                          : "bg-gov-surface text-gov-muted border border-gov-border"
                      }`}
                    >
                      3
                    </span>
                    <span>Raport i zalecenia</span>
                  </span>
                )}
              </li>
            </ol>
          </nav>
        </div>
      </div>
    </header>
  );
}
