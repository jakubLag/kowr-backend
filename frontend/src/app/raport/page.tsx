"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AnalysisResponse,
  CropType,
  ParcelSearchResponse,
} from "@/types/analysis";
import { CROP_OPTIONS } from "@/lib/crops";
import {
  analyzeParcelWater,
  ApiError,
  searchParcelByTeryt,
} from "@/lib/api";
import {
  getStoredParcel,
  saveStoredParcel,
  updateRecentParcelAnalysis,
} from "@/lib/parcelStore";
import {
  getOrBuild60DayDecades,
  getOrBuildDailyWeatherSeries,
  getTodayIsoString,
  isHistoricalTargetDate,
} from "@/lib/retentionSimulator";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import LoadingAnalysis from "@/components/LoadingAnalysis";
import BasicFarmerReport from "@/components/report/BasicFarmerReport";
import Step1Assessment from "@/components/report/Step1Assessment";
import Step2Retention from "@/components/report/Step2Retention";
import Step3Irrigation from "@/components/report/Step3Irrigation";
import CropRotationComparison from "@/components/report/CropRotationComparison";
import TransparencyBox from "@/components/report/TransparencyBox";

function ReportPageContent() {
  const searchParams = useSearchParams();
  const terytParam = searchParams.get("teryt");
  const cropParam = (searchParams.get("crop") as CropType) || "kukurydza";
  const dateParam = searchParams.get("date") || getTodayIsoString();
  const initialViewParam = searchParams.get("view");
  const isArchive = useMemo(() => isHistoricalTargetDate(dateParam), [dateParam]);

  const [viewMode, setViewMode] = useState<"basic" | "full">(
    initialViewParam === "full" ? "full" : "basic"
  );
  const [parcel, setParcel] = useState<ParcelSearchResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(true);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] =
    useState<AnalysisResponse | null>(null);

  const cropLabel =
    CROP_OPTIONS.find((c) => c.id === cropParam)?.name_pl || cropParam;

  useEffect(() => {
    if (!terytParam) {
      setIsAnalyzing(false);
      setAnalyzeError("Brak identyfikatora działki TERYT w parametrach adresu.");
      return;
    }

    setIsAnalyzing(true);
    setAnalyzeError(null);

    async function loadParcelAndAnalyze(teryt: string) {
      let currentParcel = getStoredParcel(teryt);
      if (!currentParcel) {
        try {
          currentParcel = await searchParcelByTeryt(teryt);
          saveStoredParcel(currentParcel);
        } catch {
          currentParcel = null;
        }
      }
      setParcel(currentParcel);

      try {
        const res = await analyzeParcelWater({
          teryt,
          crop: cropParam,
          target_date: dateParam,
        });
        setAnalysisResult(res);
        const resolvedParcel = res.parcel_info || currentParcel;
        if (res.parcel_info && !currentParcel) {
          setParcel(res.parcel_info);
          saveStoredParcel(res.parcel_info);
        }
        if (resolvedParcel) {
          const isWaterlogged =
            res.step1_diagnosis.drought_risk_level
              .toUpperCase()
              .includes("NADMIAR") ||
            res.step1_diagnosis.kbw_30d_mm >
              Math.max(35, res.step1_diagnosis.awc_mm * 0.85) ||
            res.step1_diagnosis.kbw_60d_mm >
              Math.max(60, res.step1_diagnosis.awc_mm * 1.4);

          updateRecentParcelAnalysis(resolvedParcel, {
            riskLevel: isWaterlogged
              ? "NADMIAR"
              : res.step1_diagnosis.drought_risk_level,
            kbw30dMm: res.step1_diagnosis.kbw_30d_mm,
            crop: cropParam,
            cropLabel,
            targetDate: res.metadata.target_date || dateParam,
            analyzedAt:
              res.metadata.generated_at ||
              res.metadata.analysis_date ||
              getTodayIsoString(),
          });
        }
      } catch (err) {
        if (err instanceof ApiError) {
          setAnalyzeError(err.message);
        } else {
          setAnalyzeError(
            "Nie udało się wygenerować raportu dla wskazanej działki."
          );
        }
      } finally {
        setIsAnalyzing(false);
      }
    }

    loadParcelAndAnalyze(terytParam);
  }, [terytParam, cropParam, dateParam, cropLabel]);

  const handlePrintPdf = () => {
    window.print();
  };

  const handleSwitchViewMode = (mode: "basic" | "full") => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const targetStateDate =
    analysisResult?.metadata.target_date || dateParam;
  const generatedAtLabel =
    analysisResult?.metadata.generated_at ||
    analysisResult?.metadata.analysis_date ||
    getTodayIsoString();

  const weatherSeries = useMemo(() => {
    if (!analysisResult) return [];
    return getOrBuildDailyWeatherSeries(
      analysisResult.step1_diagnosis,
      dateParam || analysisResult.metadata.analysis_date,
      analysisResult.kc_coefficient,
      cropParam
    );
  }, [analysisResult, dateParam, cropParam]);

  const forecastDecades = useMemo(() => {
    if (!analysisResult) return [];
    return getOrBuild60DayDecades(
      analysisResult.step1_diagnosis,
      weatherSeries,
      cropParam
    );
  }, [analysisResult, weatherSeries, cropParam]);

  return (
    <div className="min-h-screen flex flex-col bg-white text-gov-text">
      <AppHeader
        currentStep={3}
        teryt={terytParam}
        crop={cropParam}
        date={dateParam}
      />

      <main className="flex-1 gov-container pt-8 print:max-w-none print:p-0">
        {/* Stan oczekiwania */}
        {isAnalyzing && terytParam && (
          <div className="print:hidden">
            <LoadingAnalysis
              teryt={terytParam}
              cropLabel={cropLabel}
              analysisDate={dateParam}
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
              {terytParam ? (
                <Link
                  href={`/parametry?teryt=${encodeURIComponent(terytParam)}&crop=${encodeURIComponent(cropParam)}&date=${encodeURIComponent(dateParam)}`}
                  className="gov-btn-secondary"
                >
                  Wróć do wyboru parametrów
                </Link>
              ) : (
                <Link href="/" className="gov-btn-primary">
                  Wróć do wyszukiwania działki
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Dokument raportu */}
        {analysisResult && !isAnalyzing && (
          <article className="max-w-4xl space-y-8 print:max-w-none print:space-y-6">
            {/* Pasek akcji u góry (ukrywany przy druku) */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-gov-border print:hidden">
              <div className="flex flex-wrap items-center gap-2.5">
                {terytParam && (
                  <>
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
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={handlePrintPdf}
                className="gov-btn-primary"
              >
                {viewMode === "basic"
                  ? "Pobierz raport PDF (wersja podstawowa)"
                  : "Pobierz pełny raport PDF"}
              </button>
            </div>

            {/* Przełącznik wersji raportu: Podstawowy (dla rolnika) vs Pełny (szczegółowy) */}
            <div className="bg-gov-surface border border-gov-border p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-gov-navy">
                  Tryb wyświetlania raportu
                </div>
                <p className="text-xs text-gov-secondary">
                  {viewMode === "basic"
                    ? "Widok podstawowy — najważniejsze wnioski i zalecenia prostym językiem dla rolnika."
                    : "Pełny raport szczegółowy — wykresy, dane satelitarne Sentinel-2, mapa, 6 dekad i źródła."}
                </p>
              </div>
              <div
                role="tablist"
                aria-label="Wybór wersji raportu"
                className="inline-flex border border-gov-border bg-white rounded-[2px] overflow-hidden shrink-0"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === "basic"}
                  onClick={() => setViewMode("basic")}
                  className={`px-3.5 py-2 text-xs font-semibold border-r border-gov-border transition-colors ${
                    viewMode === "basic"
                      ? "bg-gov-blue text-white"
                      : "text-gov-text hover:bg-gov-surface"
                  }`}
                >
                  Widok dla rolnika (podstawowy)
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === "full"}
                  onClick={() => setViewMode("full")}
                  className={`px-3.5 py-2 text-xs font-semibold transition-colors ${
                    viewMode === "full"
                      ? "bg-gov-blue text-white"
                      : "text-gov-text hover:bg-gov-surface"
                  }`}
                >
                  Pełny raport szczegółowy
                </button>
              </div>
            </div>

            {/* Nagłówek urzędowy raportu */}
            <header className="space-y-5">
              <div className="hidden print:flex items-center justify-between pb-3 border-b-2 border-gov-navy text-xs">
                <div>
                  Krajowy Ośrodek Wsparcia Rolnictwa —{" "}
                  {viewMode === "basic"
                    ? "Raport podstawowy (dla rolnika)"
                    : "Pełny raport szczegółowy"}
                </div>
                <div className="font-mono">
                  Data badanego stanu: {targetStateDate} • Wygenerowano:{" "}
                  {generatedAtLabel}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-gov-blue mb-1 print:text-gov-secondary">
                  Krajowy Ośrodek Wsparcia Rolnictwa — Raport doradczy dla
                  gospodarstwa
                </p>
                <h1 className="text-2xl sm:text-3xl font-bold text-gov-navy">
                  Ocena sytuacji wodnej i zalecenia dla działki{" "}
                  <span className="font-mono">{analysisResult.teryt}</span>
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
                    <th>Data badanego stanu</th>
                    <th>Wygenerowano</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-mono font-bold">
                      {analysisResult.teryt}
                    </td>
                    <td>
                      {parcel?.commune || analysisResult.parcel_info?.commune
                        ? `gm. ${parcel?.commune || analysisResult.parcel_info?.commune}, obręb ${parcel?.precinct || analysisResult.parcel_info?.precinct || "—"}`
                        : "Zgodnie z rejestrem ewidencji gruntów"}
                    </td>
                    <td className="font-mono font-bold">
                      {analysisResult.parcel_info.area_ha} ha
                    </td>
                    <td className="font-bold">{cropLabel}</td>
                    <td className="font-mono font-bold text-gov-navy">
                      {targetStateDate}
                      {isArchive && (
                        <span className="block text-[10px] font-sans font-semibold text-gov-secondary">
                          analiza historyczna
                        </span>
                      )}
                    </td>
                    <td className="font-mono text-xs text-gov-secondary">
                      {generatedAtLabel}
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
                  Dla działki{" "}
                  <strong className="font-mono">{analysisResult.teryt}</strong>{" "}
                  ({analysisResult.parcel_info.area_ha} ha, uprawa:{" "}
                  <strong>{cropLabel}</strong>) stwierdzono{" "}
                  <strong>
                    {analysisResult.step1_diagnosis.drought_risk_level.toLowerCase()}{" "}
                    ryzyko suszy
                  </strong>{" "}
                  ({analysisResult.step1_diagnosis.kbw_status}, bilans 30-dniowy:{" "}
                  <strong className="font-mono">
                    {analysisResult.step1_diagnosis.kbw_30d_mm} mm
                  </strong>
                  ).{" "}
                  {analysisResult.step3_irrigation?.needed
                    ? `W pierwszej kolejności wdróż priorytetowe zabiegi retencyjne z Etapu 2, a doraźnie zastosuj nawadnianie interwencyjne w dawce ${analysisResult.step3_irrigation.dose_mm ?? 0} mm.`
                    : "Dodatkowe nawadnianie interwencyjne nie jest obecnie wymagane — zaleca się wdrożenie praktyk retencyjnych wskazanych w Etapie 2."}
                </p>
              </div>
            </header>

            {viewMode === "basic" ? (
              <BasicFarmerReport
                analysis={analysisResult}
                cropLabel={cropLabel}
                weatherSeries={weatherSeries}
                isArchive={isArchive}
                onOpenFullReport={() => handleSwitchViewMode("full")}
              />
            ) : (
              <>
                <Step1Assessment
                  diagnosis={analysisResult.step1_diagnosis}
                  parcelInfo={analysisResult.parcel_info || parcel}
                  cropName={cropLabel}
                  kcCoefficient={analysisResult.kc_coefficient}
                  weatherSeries={weatherSeries}
                  forecastDecades={forecastDecades}
                  targetDate={targetStateDate}
                  isArchive={isArchive}
                />

                <Step2Retention
                  recommendations={analysisResult.step2_retention}
                  diagnosis={analysisResult.step1_diagnosis}
                />

                {analysisResult.step3_irrigation && (
                  <Step3Irrigation
                    irrigation={analysisResult.step3_irrigation}
                    areaHa={
                      analysisResult.parcel_info?.area_ha ??
                      parcel?.area_ha ??
                      1.0
                    }
                    cropName={cropLabel}
                    forecastDecades={forecastDecades}
                    diagnosis={analysisResult.step1_diagnosis}
                    weatherSeries={weatherSeries}
                    isArchive={isArchive}
                  />
                )}

                <CropRotationComparison
                  teryt={analysisResult.teryt}
                  currentCropId={cropParam}
                  currentKc={analysisResult.kc_coefficient}
                  analysisDate={targetStateDate}
                  diagnosis={analysisResult.step1_diagnosis}
                />

                <TransparencyBox
                  metadata={analysisResult.metadata}
                  diagnosis={analysisResult.step1_diagnosis}
                  targetDate={targetStateDate}
                />

                <div className="pt-4 border-t border-gov-border flex flex-wrap items-center justify-between gap-3 print:hidden">
                  <span className="text-xs text-gov-secondary">
                    Przeglądasz pełny raport szczegółowy (wersja doradcza).
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSwitchViewMode("basic")}
                    className="gov-btn-secondary text-xs py-2 px-4"
                  >
                    ← Wróć do uproszczonego widoku dla rolnika
                  </button>
                </div>
              </>
            )}

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
