"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CropType, ParcelSearchResponse } from "@/types/analysis";
import { CROP_OPTIONS, DEFAULT_SAMPLE_TERYT } from "@/lib/mockData";
import { searchParcelByTeryt } from "@/lib/api";
import {
  getForceMockPreference,
  getStoredParcel,
  saveStoredParcel,
  setForceMockPreference,
} from "@/lib/parcelStore";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";

function Step2ParametersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const terytParam = searchParams.get("teryt");
  const initialCropParam = searchParams.get("crop") as CropType | null;
  const initialDateParam = searchParams.get("date");

  const [parcel, setParcel] = useState<ParcelSearchResponse | null>(null);
  const [isLoadingParcel, setIsLoadingParcel] = useState<boolean>(true);
  const [selectedCrop, setSelectedCrop] = useState<CropType>(
    initialCropParam && CROP_OPTIONS.some((c) => c.id === initialCropParam)
      ? initialCropParam
      : "kukurydza"
  );
  const [analysisDate, setAnalysisDate] = useState<string>(
    initialDateParam || "2026-11-21"
  );
  const [forceMock, setForceMock] = useState<boolean>(false);
  const [dataSourceMode, setDataSourceMode] = useState<"api" | "mock" | null>(
    null
  );

  useEffect(() => {
    const pref = getForceMockPreference();
    setForceMock(pref);

    const cached = getStoredParcel(terytParam);
    if (cached) {
      setParcel(cached);
      setIsLoadingParcel(false);
      return;
    }

    const targetTeryt = terytParam || DEFAULT_SAMPLE_TERYT;
    searchParcelByTeryt(targetTeryt, pref)
      .then((res) => {
        setParcel(res.data);
        setDataSourceMode(res.source);
        saveStoredParcel(res.data);
      })
      .catch(() => {
        setParcel(null);
      })
      .finally(() => {
        setIsLoadingParcel(false);
      });
  }, [terytParam]);

  const handleToggleForceMock = () => {
    const nextVal = !forceMock;
    setForceMock(nextVal);
    setForceMockPreference(nextVal);
  };

  const handleSubmitAnalysis = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parcel) return;
    router.push(
      `/raport?teryt=${encodeURIComponent(parcel.teryt)}&crop=${encodeURIComponent(selectedCrop)}&date=${encodeURIComponent(analysisDate)}`
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-gov-text">
      <AppHeader
        currentStep={2}
        teryt={parcel?.teryt}
        crop={selectedCrop}
        date={analysisDate}
        dataSourceMode={dataSourceMode}
        forceMock={forceMock}
        onToggleForceMock={handleToggleForceMock}
      />

      <main className="flex-1 gov-container pt-8">
        <div className="max-w-4xl">
          {/* Nagłówek sekcji Kroku 2 */}
          <div className="border-b border-gov-border pb-5 mb-6">
            <p className="text-xs font-bold text-gov-blue mb-1">
              Krok 2 z 2 — Parametry analizy agrotechnicznej
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-gov-navy">
              Wybierz aktualną uprawę i datę analizy
            </h1>
            <p className="text-sm text-gov-secondary mt-1.5 leading-relaxed">
              Wskaż roślinę uprawianą na wybranej działce oraz dzień, dla
              którego system ma obliczyć bilans wodny i zalecenia retencyjne.
            </p>
          </div>

          {/* Podsumowanie wybranej działki z Kroku 1 */}
          <div className="gov-callout-info mb-8 flex flex-wrap items-center justify-between gap-4">
            {isLoadingParcel ? (
              <span className="text-sm text-gov-secondary">
                Wczytywanie danych wybranej działki...
              </span>
            ) : parcel ? (
              <>
                <div className="space-y-0.5 text-sm">
                  <div className="font-bold text-gov-navy">
                    Wybrana działka:{" "}
                    <span className="font-mono">{parcel.teryt}</span> (
                    {parcel.area_ha} ha)
                  </div>
                  <div className="text-xs text-gov-secondary">
                    Gmina: <strong className="text-gov-text">{parcel.commune}</strong>{" "}
                    • Obręb:{" "}
                    <strong className="text-gov-text">{parcel.precinct}</strong>{" "}
                    • Powiat: {parcel.county} (woj. {parcel.voivodeship})
                  </div>
                </div>

                <Link
                  href={`/?teryt=${encodeURIComponent(parcel.teryt)}`}
                  className="gov-btn-secondary text-xs py-2 px-3.5"
                >
                  Zmień działkę
                </Link>
              </>
            ) : (
              <div className="w-full flex items-center justify-between">
                <span className="text-sm text-gov-danger font-bold">
                  Nie wybrano działki ewidencyjnej.
                </span>
                <Link href="/" className="gov-btn-primary text-xs py-2 px-3.5">
                  Wróć do wyszukiwania działki
                </Link>
              </div>
            )}
          </div>

          {/* Formularz wyboru uprawy i daty */}
          <form onSubmit={handleSubmitAnalysis} className="space-y-8">
            {/* Pole 1: Wybór uprawy */}
            <fieldset>
              <legend className="gov-label text-base text-gov-navy">
                1. Aktualna uprawa na działce
              </legend>
              <span className="gov-hint">
                Wybierz jedną pozycję z listy. Rodzaj uprawy decyduje o
                zapotrzebowaniu na wodę oraz wrażliwości na suszę.
              </span>

              <table className="gov-table border border-gov-border mt-3">
                <thead>
                  <tr>
                    <th className="w-2/5">Nazwa uprawy</th>
                    <th className="hidden sm:table-cell">
                      Okres kluczowego zapotrzebowania na wodę
                    </th>
                    <th className="w-36 text-right">Wrażliwość wodna</th>
                  </tr>
                </thead>
                <tbody>
                  {CROP_OPTIONS.map((crop) => {
                    const isSelected = selectedCrop === crop.id;
                    return (
                      <tr
                        key={crop.id}
                        onClick={() => setSelectedCrop(crop.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-gov-blue-light"
                            : "bg-white hover:bg-gov-surface/60"
                        }`}
                      >
                        <td>
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="radio"
                              name="crop_type"
                              value={crop.id}
                              checked={isSelected}
                              onChange={() => setSelectedCrop(crop.id)}
                              className="w-4 h-4 accent-gov-blue shrink-0"
                            />
                            <span
                              className={`text-sm ${
                                isSelected
                                  ? "font-bold text-gov-navy"
                                  : "font-medium text-gov-text"
                              }`}
                            >
                              {crop.label}
                            </span>
                          </label>
                        </td>
                        <td className="text-gov-secondary text-xs hidden sm:table-cell">
                          {crop.criticalPhase}
                        </td>
                        <td className="text-right font-semibold text-xs">
                          {crop.waterDemand}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </fieldset>

            {/* Pole 2: Data analizy */}
            <div className="pt-6 border-t border-gov-border">
              <label
                htmlFor="analysis-date"
                className="gov-label text-base text-gov-navy"
              >
                2. Data analizy
              </label>
              <span className="gov-hint">
                Domyślnie ustawiona jest dzisiejsza data (2026-11-21). Możesz
                również wybrać dowolną datę historyczną z ostatnich 10 lat
                (2016–2026).
              </span>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-2">
                <input
                  id="analysis-date"
                  type="date"
                  value={analysisDate}
                  min="2016-01-01"
                  max="2026-11-21"
                  onChange={(e) => setAnalysisDate(e.target.value)}
                  className="gov-input font-mono font-bold sm:w-56"
                />

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gov-secondary">
                    Przykładowe daty:
                  </span>
                  <button
                    type="button"
                    onClick={() => setAnalysisDate("2026-11-21")}
                    className={`gov-btn-neutral font-mono ${
                      analysisDate === "2026-11-21"
                        ? "border-gov-blue bg-gov-blue-light text-gov-blue font-bold"
                        : ""
                    }`}
                  >
                    2026-11-21 (Dzisiaj)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnalysisDate("2026-07-15")}
                    className={`gov-btn-neutral font-mono ${
                      analysisDate === "2026-07-15"
                        ? "border-gov-blue bg-gov-blue-light text-gov-blue font-bold"
                        : ""
                    }`}
                  >
                    2026-07-15 (Szczyt lata)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnalysisDate("2018-07-20")}
                    className={`gov-btn-neutral font-mono ${
                      analysisDate === "2018-07-20"
                        ? "border-gov-blue bg-gov-blue-light text-gov-blue font-bold"
                        : ""
                    }`}
                  >
                    2018-07-20 (Susza 2018)
                  </button>
                </div>
              </div>
            </div>

            {/* Przyciski nawigacji formularza */}
            <div className="pt-6 border-t border-gov-border flex flex-wrap items-center justify-between gap-4">
              <Link
                href={
                  parcel ? `/?teryt=${encodeURIComponent(parcel.teryt)}` : "/"
                }
                className="gov-btn-secondary"
              >
                Wstecz: Wyszukanie działki
              </Link>

              <button
                type="submit"
                disabled={!parcel}
                className="gov-btn-primary px-7 py-3 text-base"
              >
                Analizuj sytuację wodną
              </button>
            </div>
          </form>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}

export default function Step2Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center text-sm text-gov-secondary">
          Wczytywanie formularza parametrów...
        </div>
      }
    >
      <Step2ParametersContent />
    </Suspense>
  );
}
