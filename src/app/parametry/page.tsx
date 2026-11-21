"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CropType, ParcelSearchResponse } from "@/types/analysis";
import {
  calculateCropKcForMonth,
  CROP_OPTIONS,
  CropOption,
  getMonthGrowthStageDescription,
} from "@/lib/crops";
import { fetchSupportedCrops, searchParcelByTeryt } from "@/lib/api";
import { getStoredParcel, saveStoredParcel } from "@/lib/parcelStore";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";

function getTodayIsoString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function Step2ParametersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const terytParam = searchParams.get("teryt");
  const initialCropParam = searchParams.get("crop") as CropType | null;
  const initialDateParam = searchParams.get("date");

  const todayIso = useMemo(() => getTodayIsoString(), []);

  const [parcel, setParcel] = useState<ParcelSearchResponse | null>(null);
  const [isLoadingParcel, setIsLoadingParcel] = useState<boolean>(true);
  const [crops, setCrops] = useState<CropOption[]>(CROP_OPTIONS);
  const [selectedCrop, setSelectedCrop] = useState<CropType>(
    initialCropParam && CROP_OPTIONS.some((c) => c.id === initialCropParam)
      ? initialCropParam
      : "kukurydza"
  );

  // Tryb daty: "current" (bieżąca sytuacja wodna) lub "custom" (wybrany dzień sezonu / historia)
  const [dateMode, setDateMode] = useState<"current" | "custom">(
    initialDateParam && initialDateParam !== todayIso ? "custom" : "current"
  );
  const [customDate, setCustomDate] = useState<string>(
    initialDateParam || todayIso
  );

  const effectiveDate = dateMode === "current" ? todayIso : customDate;

  useEffect(() => {
    // Pobranie aktualnego słownika upraw z backendu GET /api/crops
    fetchSupportedCrops()
      .then((remoteCrops) => {
        if (!Array.isArray(remoteCrops) || remoteCrops.length === 0) return;
        const merged: CropOption[] = remoteCrops.map((rc) => {
          const localMatch = CROP_OPTIONS.find((lc) => lc.id === rc.id);
          return {
            id: rc.id as CropType,
            name_pl: rc.name_pl,
            kc_initial: rc.kc_initial,
            kc_mid: rc.kc_mid,
            kc_end: rc.kc_end,
            root_depth_m: rc.root_depth_m,
            drought_sensitivity: rc.drought_sensitivity,
            criticalPhase:
              localMatch?.criticalPhase ||
              "Okres intensywnego wzrostu i zawiązywania plonu",
          };
        });
        setCrops(merged);
      })
      .catch(() => {
        // W razie błędu sieci zachowujemy zsynchronizowany słownik CROP_OPTIONS
      });
  }, []);

  useEffect(() => {
    if (!terytParam) {
      setIsLoadingParcel(false);
      return;
    }

    const cached = getStoredParcel(terytParam);
    if (cached) {
      setParcel(cached);
      setIsLoadingParcel(false);
      return;
    }

    searchParcelByTeryt(terytParam)
      .then((res) => {
        setParcel(res);
        saveStoredParcel(res);
      })
      .catch(() => {
        setParcel(null);
      })
      .finally(() => {
        setIsLoadingParcel(false);
      });
  }, [terytParam]);

  const activeCropObj =
    crops.find((c) => c.id === selectedCrop) || crops[0];

  const selectedMonth = useMemo(() => {
    const parts = effectiveDate.split("-");
    const m = parts.length >= 2 ? parseInt(parts[1], 10) : NaN;
    return Number.isNaN(m) ? new Date().getMonth() + 1 : m;
  }, [effectiveDate]);

  const estimatedKc = useMemo(
    () => calculateCropKcForMonth(activeCropObj, selectedMonth),
    [activeCropObj, selectedMonth]
  );

  const stageDescription = useMemo(
    () => getMonthGrowthStageDescription(selectedMonth),
    [selectedMonth]
  );

  const handleSubmitAnalysis = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parcel) return;
    router.push(
      `/raport?teryt=${encodeURIComponent(parcel.teryt)}&crop=${encodeURIComponent(selectedCrop)}&date=${encodeURIComponent(effectiveDate)}`
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-gov-text">
      <AppHeader
        currentStep={2}
        teryt={parcel?.teryt}
        crop={selectedCrop}
        date={effectiveDate}
      />

      <main className="flex-1 gov-container pt-8">
        <div className="max-w-4xl">
          {/* Nagłówek sekcji Kroku 2 */}
          <div className="border-b border-gov-border pb-5 mb-6">
            <p className="text-xs font-bold text-gov-blue mb-1">
              Krok 2 z 2 — Parametry analizy agrohydrologicznej
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-gov-navy">
              Wybierz uprawę oraz termin oceny sytuacji wodnej
            </h1>
            <p className="text-sm text-gov-secondary mt-1.5 leading-relaxed">
              Wskaż gatunek rośliny uprawianej na działce oraz termin analizy.
              Na tej podstawie system wyznaczy współczynnik zapotrzebowania
              wodnego uprawy (Kc wg metodyki FAO-56) i obliczy bilans wodny.
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
                    Gmina:{" "}
                    <strong className="text-gov-text">
                      {parcel.commune || "—"}
                    </strong>{" "}
                    • Obręb:{" "}
                    <strong className="text-gov-text">
                      {parcel.precinct || "—"}
                    </strong>{" "}
                    {parcel.county ? `• ${parcel.county}` : ""}{" "}
                    {parcel.voivodeship ? `(woj. ${parcel.voivodeship})` : ""}
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
                1. Gatunek uprawy na badanej działce
              </legend>
              <span className="gov-hint">
                Wybierz jedną uprawę z katalogu KOWR / IUNG-PIB. Parametry
                korzenienia i wrażliwości na suszę są pobierane bezpośrednio z
                modelu agronomicznego.
              </span>

              <table className="gov-table border border-gov-border mt-3 tabular-nums">
                <thead>
                  <tr>
                    <th className="w-2/5">Nazwa uprawy</th>
                    <th className="hidden md:table-cell">
                      Faza krytycznej wrażliwości na niedobór wody
                    </th>
                    <th className="w-28 text-right hidden sm:table-cell">
                      Strefa korzeni
                    </th>
                    <th className="w-36 text-right">Wrażliwość na suszę</th>
                  </tr>
                </thead>
                <tbody>
                  {crops.map((crop) => {
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
                              {crop.name_pl}
                            </span>
                          </label>
                        </td>
                        <td className="text-gov-secondary text-xs hidden md:table-cell">
                          {crop.criticalPhase}
                        </td>
                        <td className="text-right font-mono text-xs text-gov-secondary hidden sm:table-cell">
                          {crop.root_depth_m.toFixed(1)} m
                        </td>
                        <td className="text-right font-semibold text-xs">
                          <span
                            className={
                              crop.drought_sensitivity.includes("WYSOKA")
                                ? "text-gov-danger font-bold"
                                : crop.drought_sensitivity === "ŚREDNIA"
                                  ? "text-gov-warning font-bold"
                                  : "text-gov-success font-bold"
                            }
                          >
                            {crop.drought_sensitivity}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </fieldset>

            {/* Pole 2: Tryb i data analizy */}
            <fieldset className="pt-6 border-t border-gov-border space-y-4">
              <legend className="gov-label text-base text-gov-navy">
                2. Termin analizy sytuacji wodnej
              </legend>
              <span className="gov-hint">
                Wybierz ocenę bieżącej sytuacji wodnej na polu lub wskaż
                konkretny dzień sezonu wegetacyjnego (np. na potrzeby analizy
                historycznej z ostatnich 10 lat).
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <label
                  className={`border p-4 cursor-pointer transition-colors flex items-start gap-3 ${
                    dateMode === "current"
                      ? "border-gov-blue bg-gov-blue-light"
                      : "border-gov-border bg-white hover:bg-gov-surface/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="date_mode"
                    checked={dateMode === "current"}
                    onChange={() => setDateMode("current")}
                    className="w-4 h-4 accent-gov-blue mt-0.5 shrink-0"
                  />
                  <div>
                    <span className="text-sm font-bold text-gov-navy block">
                      Aktualny stan wodny (dzisiaj)
                    </span>
                    <span className="text-xs text-gov-secondary mt-1 block leading-relaxed">
                      Analiza na dzień{" "}
                      <strong className="font-mono text-gov-text">
                        {todayIso}
                      </strong>{" "}
                      w oparciu o bieżące opady i parowanie z ostatnich 30 oraz
                      60 dni.
                    </span>
                  </div>
                </label>

                <label
                  className={`border p-4 cursor-pointer transition-colors flex items-start gap-3 ${
                    dateMode === "custom"
                      ? "border-gov-blue bg-gov-blue-light"
                      : "border-gov-border bg-white hover:bg-gov-surface/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="date_mode"
                    checked={dateMode === "custom"}
                    onChange={() => setDateMode("custom")}
                    className="w-4 h-4 accent-gov-blue mt-0.5 shrink-0"
                  />
                  <div>
                    <span className="text-sm font-bold text-gov-navy block">
                      Wybrana data (sezon wegetacyjny / historia)
                    </span>
                    <span className="text-xs text-gov-secondary mt-1 block leading-relaxed">
                      Pozwala zbadać bilans wodny dla dowolnego dnia sezonu (np.
                      szczyt lata lub historyczne susze z lat 2016–2026).
                    </span>
                  </div>
                </label>
              </div>

              {dateMode === "custom" && (
                <div className="pt-2">
                  <label htmlFor="analysis-date" className="gov-label">
                    Wskaż datę analizy (RRRR-MM-DD)
                  </label>
                  <input
                    id="analysis-date"
                    type="date"
                    value={customDate}
                    min="2016-01-01"
                    max="2026-12-31"
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="gov-input font-mono font-bold sm:w-60 mt-1"
                  />
                </div>
              )}
            </fieldset>

            {/* Podgląd parametrów modelu FAO-56 przed uruchomieniem analizy */}
            <div className="gov-callout-info space-y-1.5">
              <div className="text-sm font-bold text-gov-navy">
                Parametry modelu FAO-56 przyjęte do obliczeń
              </div>
              <p className="text-xs text-gov-text leading-relaxed">
                Uprawa: <strong>{activeCropObj.name_pl}</strong> (głębokość
                systemu korzeniowego:{" "}
                <strong className="font-mono">
                  {activeCropObj.root_depth_m.toFixed(1)} m
                </strong>
                , wrażliwość na suszę:{" "}
                <strong>{activeCropObj.drought_sensitivity}</strong>).
              </p>
              <p className="text-xs text-gov-secondary leading-relaxed">
                Dla daty{" "}
                <strong className="font-mono text-gov-text">
                  {effectiveDate}
                </strong>{" "}
                przypada: <em>{stageDescription}</em> — przyjęty współczynnik
                roślinny{" "}
                <strong className="font-mono text-gov-navy">
                  Kc = {estimatedKc.toFixed(2)}
                </strong>
                .
              </p>
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
