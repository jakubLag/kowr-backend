"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AnalysisResponse,
  CropType,
  ParcelSearchResponse,
} from "@/types/analysis";
import {
  CROP_OPTIONS,
  DEFAULT_SAMPLE_TERYT,
  getMockAnalysis,
} from "@/lib/mockData";
import {
  analyzeParcelWater,
  ApiError,
  searchParcelByTeryt,
} from "@/lib/api";
import {
  getForceMockPreference,
  getStoredParcel,
  saveStoredParcel,
  setForceMockPreference,
} from "@/lib/parcelStore";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import LoadingAnalysis from "@/components/LoadingAnalysis";
import Step1Assessment from "@/components/report/Step1Assessment";
import Step2Retention from "@/components/report/Step2Retention";
import Step3Irrigation from "@/components/report/Step3Irrigation";
import TransparencyBox from "@/components/report/TransparencyBox";

function ReportPageContent() {
  const searchParams = useSearchParams();
  const terytParam = searchParams.get("teryt") || DEFAULT_SAMPLE_TERYT;
  const cropParam = (searchParams.get("crop") as CropType) || "kukurydza";
  const dateParam = searchParams.get("date") || "2026-11-21";

  const [parcel, setParcel] = useState<ParcelSearchResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(true);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] =
    useState<AnalysisResponse | null>(null);
  const [forceMock, setForceMock] = useState<boolean>(false);
  const [dataSourceMode, setDataSourceMode] = useState<"api" | "mock" | null>(
    null
  );

  const skipRef = useRef<boolean>(false);

  useEffect(() => {
    const pref = getForceMockPreference();
    setForceMock(pref);
    skipRef.current = false;
    setIsAnalyzing(true);
    setAnalyzeError(null);

    async function loadParcelAndAnalyze() {
      let currentParcel = getStoredParcel(terytParam);
      if (!currentParcel) {
        try {
          const pRes = await searchParcelByTeryt(terytParam, pref);
          currentParcel = pRes.data;
          saveStoredParcel(currentParcel);
        } catch {
          currentParcel = null;
        }
      }
      setParcel(currentParcel);

      try {
        const res = await analyzeParcelWater(
          {
            teryt: terytParam,
            crop_type: cropParam,
            analysis_date: dateParam,
          },
          currentParcel,
          pref,
          11000
        );
        if (!skipRef.current) {
          setAnalysisResult(res.data);
          setDataSourceMode(res.source);
          setIsAnalyzing(false);
        }
      } catch (err) {
        if (!skipRef.current) {
          if (err instanceof ApiError) {
            setAnalyzeError(err.message);
          } else {
            setAnalyzeError(
              "Nie udało się wygenerować raportu dla wskazanej działki."
            );
          }
          setIsAnalyzing(false);
        }
      }
    }

    loadParcelAndAnalyze();
  }, [terytParam, cropParam, dateParam]);

  const handleToggleForceMock = () => {
    const nextVal = !forceMock;
    setForceMock(nextVal);
    setForceMockPreference(nextVal);
  };

  const handleSkipDemoLoading = () => {
    skipRef.current = true;
    const instantMock = getMockAnalysis(
      {
        teryt: terytParam,
        crop_type: cropParam,
        analysis_date: dateParam,
      },
      parcel
    );
    setAnalysisResult(instantMock);
    setDataSourceMode("mock");
    setIsAnalyzing(false);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const cropLabel =
    CROP_OPTIONS.find((c) => c.id === cropParam)?.label || "Kukurydza";

  return (
    <div className="min-h-screen flex flex-col bg-white text-gov-text">
      <AppHeader
        currentStep={3}
        teryt={terytParam}
        crop={cropParam}
        date={dateParam}
        dataSourceMode={dataSourceMode}
        forceMock={forceMock}
        onToggleForceMock={handleToggleForceMock}
      />

      <main className="flex-1 gov-container pt-8 print:max-w-none print:p-0">
        {/* Stan oczekiwania (10-25 s) */}
        {isAnalyzing && (
          <div className="print:hidden">
            <LoadingAnalysis
              teryt={terytParam}
              cropLabel={cropLabel}
              analysisDate={dateParam}
              onSkipDemo={handleSkipDemoLoading}
            />
          </div>
        )}

        {/* Stan błędu */}
        {analyzeError && !isAnalyzing && (
          <div className="max-w-2xl my-6 space-y-4">
            <div role="alert" className="gov-callout-danger">
              <div className="text-base font-bold text-gov-danger">
                Nie udało się wygenerować raportu
              </div>
              <p className="text-sm text-gov-text mt-1">{analyzeError}</p>
            </div>
            <div>
              <Link
                href={`/parametry?teryt=${encodeURIComponent(terytParam)}&crop=${encodeURIComponent(cropParam)}&date=${encodeURIComponent(dateParam)}`}
                className="gov-btn-secondary"
              >
                Wróć do wyboru parametrów
              </Link>
            </div>
          </div>
        )}

        {/* Dokument raportu */}
        {analysisResult && !isAnalyzing && (
          <article className="max-w-4xl space-y-8 print:max-w-none print:space-y-6">
            {/* Pasek akcji u góry (ukrywany przy druku) */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-gov-border print:hidden">
              <div className="flex flex-wrap items-center gap-2.5">
                <Link
                  href={`/parametry?teryt=${encodeURIComponent(terytParam)}&crop=${encodeURIComponent(cropParam)}&date=${encodeURIComponent(dateParam)}`}
                  className="gov-btn-secondary text-xs py-2 px-3.5"
                >
                  Zmień uprawę lub datę
                </Link>
                <Link
                  href={`/?teryt=${encodeURIComponent(terytParam)}`}
                  className="gov-btn-neutral py-2 px-3.5"
                >
                  Inna działka
                </Link>
              </div>

              <button
                type="button"
                onClick={handlePrintPdf}
                className="gov-btn-primary"
              >
                Pobierz raport PDF / Drukuj
              </button>
            </div>

            {/* Nagłówek urzędowy raportu (widoczny na ekranie i na wydruku A4) */}
            <header className="space-y-5">
              <div className="hidden print:flex items-center justify-between pb-3 border-b-2 border-gov-navy text-xs">
                <div>
                  <strong>gov.pl</strong> | Krajowy Ośrodek Wsparcia Rolnictwa —
                  System Wsparcia Gospodarowania Wodą w Rolnictwie
                </div>
                <div className="font-mono">
                  Data analizy: {analysisResult.metadata.analysis_date}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-gov-blue mb-1 print:text-gov-secondary">
                  Krajowy Ośrodek Wsparcia Rolnictwa — Raport doradczy dla
                  gospodarstwa
                </p>
                <h1 className="text-2xl sm:text-3xl font-bold text-gov-navy">
                  Ocena sytuacji wodnej i zalecenia dla działki{" "}
                  <span className="font-mono">
                    {analysisResult.metadata.parcel_id}
                  </span>
                </h1>
              </div>

              {/* Tabela metryki działki i badania */}
              <table className="gov-table border border-gov-border tabular-nums">
                <thead>
                  <tr>
                    <th>Identyfikator działki (TERYT)</th>
                    <th>Położenie (gmina / obręb)</th>
                    <th>Powierzchnia</th>
                    <th>Badana uprawa</th>
                    <th>Data analizy</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-mono font-bold">
                      {analysisResult.metadata.parcel_id}
                    </td>
                    <td>
                      {parcel
                        ? `gm. ${parcel.commune}, obręb ${parcel.precinct}`
                        : "Zgodnie z rejestrem ewidencji gruntów"}
                    </td>
                    <td className="font-mono font-bold">
                      {analysisResult.metadata.area_ha} ha
                    </td>
                    <td className="font-bold">
                      {analysisResult.metadata.crop}
                    </td>
                    <td className="font-mono">
                      {analysisResult.metadata.analysis_date}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Podsumowanie dla rolnika */}
              <div className="gov-callout-info">
                <div className="text-sm font-bold text-gov-navy">
                  Podsumowanie sytuacji wodnej na Twoim polu
                </div>
                <p className="text-sm sm:text-base text-gov-text mt-1 leading-relaxed">
                  {analysisResult.farmer_friendly_summary}
                </p>
              </div>
            </header>

            {/* Obowiązkowa kolejność wyświetlania wyników w raporcie wg specyfikacji KOWR:
                Etap 1 -> Etap 2 (Retencja jako priorytet) -> Etap 3 (Nawadnianie) -> Źródła i ograniczenia */}
            <Step1Assessment
              assessment={analysisResult.step_1_water_assessment}
              cropName={analysisResult.metadata.crop}
            />

            <Step2Retention
              recommendations={analysisResult.step_2_retention_recommendations}
            />

            <Step3Irrigation
              irrigation={analysisResult.step_3_irrigation_recommendations}
              areaHa={analysisResult.metadata.area_ha}
              cropName={analysisResult.metadata.crop}
            />

            <TransparencyBox metadata={analysisResult.metadata} />

            {/* Stopka dla wydruku PDF A4 */}
            <footer className="hidden print:block pt-4 border-t border-gov-border text-xs text-gov-secondary">
              Raport wygenerowany w Systemie Wsparcia Gospodarowania Wodą w
              Rolnictwie (KOWR • HackNation 2026). Dokument ma charakter
              doradczy.
            </footer>
          </article>
        )}
      </main>

      <AppFooter />
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center text-sm text-gov-secondary">
          Wczytywanie raportu wodnego...
        </div>
      }
    >
      <ReportPageContent />
    </Suspense>
  );
}
