"use client";

import React, { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { ParcelSearchResponse } from "@/types/analysis";
import { DEFAULT_SAMPLE_TERYT } from "@/lib/mockData";
import { ApiError, searchParcelByTeryt } from "@/lib/api";
import {
  getForceMockPreference,
  getStoredParcel,
  saveStoredParcel,
  setForceMockPreference,
} from "@/lib/parcelStore";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";

const ParcelMap = dynamic(() => import("@/components/ParcelMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[480px] border border-gov-border bg-gov-surface flex items-center justify-center text-xs text-gov-secondary">
      Wczytywanie mapy satelitarnej...
    </div>
  ),
});

function Step1ParcelSearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTerytParam = searchParams.get("teryt");

  const [terytInput, setTerytInput] = useState<string>(initialTerytParam || "");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [parcelError, setParcelError] = useState<string | null>(null);
  const [parcel, setParcel] = useState<ParcelSearchResponse | null>(null);
  const [dataSourceMode, setDataSourceMode] = useState<"api" | "mock" | null>(
    null
  );
  const [forceMock, setForceMock] = useState<boolean>(false);

  useEffect(() => {
    const pref = getForceMockPreference();
    setForceMock(pref);

    const cached = getStoredParcel(initialTerytParam);
    if (cached) {
      setParcel(cached);
      setTerytInput(cached.teryt);
    } else if (initialTerytParam) {
      performSearch(initialTerytParam, pref);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleForceMock = () => {
    const nextVal = !forceMock;
    setForceMock(nextVal);
    setForceMockPreference(nextVal);
  };

  const performSearch = async (targetTeryt: string, mockFlag = forceMock) => {
    const cleaned = targetTeryt.trim();
    if (!cleaned) {
      setParcelError(
        "Wpisz identyfikator działki TERYT w formacie WWPPGG_R.OOOO.NR_DZIAŁKI (np. 141201_1.0001.123/4)."
      );
      return;
    }

    setParcelError(null);
    setIsSearching(true);

    try {
      const result = await searchParcelByTeryt(cleaned, mockFlag);
      setParcel(result.data);
      setDataSourceMode(result.source);
      saveStoredParcel(result.data);
    } catch (err) {
      setParcel(null);
      if (err instanceof ApiError) {
        setParcelError(err.message);
      } else {
        setParcelError(
          "Wystąpił błąd podczas wyszukiwania działki. Sprawdź poprawność wprowadzonego kodu TERYT."
        );
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(terytInput);
  };

  const handleInsertSample = (sampleTeryt: string) => {
    setTerytInput(sampleTeryt);
    performSearch(sampleTeryt);
  };

  const handleProceedToStep2 = () => {
    if (!parcel) return;
    router.push(`/parametry?teryt=${encodeURIComponent(parcel.teryt)}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-gov-text">
      <AppHeader
        currentStep={1}
        teryt={parcel?.teryt}
        dataSourceMode={dataSourceMode}
        forceMock={forceMock}
        onToggleForceMock={handleToggleForceMock}
      />

      <main className="flex-1 gov-container pt-8">
        {/* Nagłówek sekcji Kroku 1 */}
        <div className="border-b border-gov-border pb-5 mb-8">
          <p className="text-xs font-bold text-gov-blue mb-1">
            Krok 1 z 2 — Identyfikacja działki rolnej
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gov-navy">
            Wyszukaj działkę po identyfikatorze TERYT
          </h1>
          <p className="text-sm text-gov-secondary mt-1.5 max-w-3xl leading-relaxed">
            Podaj pełny identyfikator działki ewidencyjnej, aby zlokalizować pole
            na ortofotomapie satelitarnej oraz pobrać jego powierzchnię i dane
            administracyjne.
          </p>
        </div>

        {/* Główny układ: Lewa kolumna formularz i tabela (5/12), Prawa kolumna mapa (7/12) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Lewa kolumna */}
          <div className="lg:col-span-5 space-y-6">
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label htmlFor="teryt-input" className="gov-label">
                  Identyfikator działki ewidencyjnej (TERYT)
                </label>
                <span className="gov-hint">
                  Wymagany format: <code className="font-mono font-semibold text-gov-text">WWPPGG_R.OOOO.NR_DZIAŁKI</code> (np. 141201_1.0001.123/4)
                </span>

                <div className="flex flex-col sm:flex-row gap-2.5 mt-1">
                  <input
                    id="teryt-input"
                    type="text"
                    value={terytInput}
                    onChange={(e) => setTerytInput(e.target.value)}
                    placeholder="np. 141201_1.0001.123/4"
                    aria-invalid={Boolean(parcelError)}
                    className={`gov-input font-mono flex-1 ${
                      parcelError ? "border-gov-danger focus:border-gov-danger" : ""
                    }`}
                  />
                  <button
                    type="submit"
                    disabled={isSearching}
                    className="gov-btn-primary shrink-0"
                  >
                    {isSearching ? "Wyszukiwanie..." : "Szukaj działki"}
                  </button>
                </div>
              </div>

              {/* Przycisk pomocniczy wymagany w specyfikacji + dodatkowe działki testowe */}
              <div className="pt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleInsertSample(DEFAULT_SAMPLE_TERYT)}
                  className="gov-btn-secondary text-xs py-2 px-3"
                >
                  Wstaw przykładową działkę ({DEFAULT_SAMPLE_TERYT})
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertSample("060903_2.0004.415")}
                  className="gov-btn-neutral"
                  title="Działka testowa o wysokiej retencji glebowej (woj. lubelskie)"
                >
                  Przykład 2: 060903_2.0004.415
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertSample("141201_1.0001.404")}
                  className="gov-btn-neutral"
                  title="Test komunikatu o błędzie 404 (brak działki)"
                >
                  Test błędu 404
                </button>
              </div>
            </form>

            {/* Komunikat błędu 404 w stylu gov.pl */}
            {parcelError && (
              <div role="alert" className="gov-callout-danger">
                <div className="text-sm font-bold text-gov-danger">
                  Nie znaleziono działki ewidencyjnej
                </div>
                <p className="text-sm text-gov-text mt-1 leading-relaxed">
                  {parcelError}
                </p>
              </div>
            )}

            {/* Potwierdzenie znalezionej działki (Tabela + przycisk przejścia do Kroku 2) */}
            {parcel && !parcelError ? (
              <div className="pt-4 border-t border-gov-border space-y-5">
                <div className="gov-callout-success">
                  <div className="text-sm font-bold text-gov-navy">
                    Działka została odnaleziona w rejestrze ewidencyjnym
                  </div>
                  <p className="text-xs text-gov-secondary mt-0.5">
                    Sprawdź poniższe dane oraz obrys pola na mapie po prawej
                    stronie, a następnie przejdź do wyboru uprawy.
                  </p>
                </div>

                <table className="gov-table border border-gov-border tabular-nums">
                  <tbody>
                    <tr>
                      <th className="w-2/5">Identyfikator TERYT</th>
                      <td className="font-mono font-bold">{parcel.teryt}</td>
                    </tr>
                    <tr>
                      <th>Województwo i powiat</th>
                      <td>
                        woj. {parcel.voivodeship}, pow. {parcel.county}
                      </td>
                    </tr>
                    <tr>
                      <th>Gmina</th>
                      <td className="font-bold">{parcel.commune}</td>
                    </tr>
                    <tr>
                      <th>Obręb ewidencyjny</th>
                      <td className="font-bold">{parcel.precinct}</td>
                    </tr>
                    <tr>
                      <th>Powierzchnia działki</th>
                      <td className="font-mono font-bold text-base text-gov-navy">
                        {parcel.area_ha} ha
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div>
                  <button
                    type="button"
                    onClick={handleProceedToStep2}
                    className="gov-btn-primary w-full py-3 text-base"
                  >
                    Dalej: Wybór uprawy i daty analizy (Krok 2)
                  </button>
                </div>
              </div>
            ) : (
              <div className="gov-callout-info">
                <div className="text-sm font-bold text-gov-navy">
                  Skąd pobrać identyfikator działki TERYT?
                </div>
                <p className="text-xs text-gov-secondary mt-1 leading-relaxed">
                  Identyfikator działki w formacie TERYT znajduje się we wniosku
                  o dopłaty bezpośrednie (eWniosekPlus ARiMR), na wypisie z
                  rejestru gruntów lub w serwisie Geoportal.gov.pl.
                </p>
              </div>
            )}
          </div>

          {/* Prawa kolumna: Mapa satelitarna */}
          <div className="lg:col-span-7 min-h-[500px] flex flex-col">
            <ParcelMap parcel={parcel} />
          </div>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}

export default function Step1Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center text-sm text-gov-secondary">
          Wczytywanie formularza wyszukiwania działki...
        </div>
      }
    >
      <Step1ParcelSearchContent />
    </Suspense>
  );
}
