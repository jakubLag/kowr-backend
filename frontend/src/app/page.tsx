"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  LandUseCheckResult,
  LocationSuggestion,
  ParcelSearchResponse,
} from "@/types/analysis";
import {
  ApiError,
  checkPointLandUse,
  searchLocations,
  searchParcelByPoint,
  searchParcelByTeryt,
} from "@/lib/api";
import {
  getRecentParcels,
  getStoredParcel,
  removeRecentParcel,
  saveStoredParcel,
} from "@/lib/parcelStore";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import type { MapFlyTarget } from "@/components/ParcelMap";

const ParcelMap = dynamic(() => import("@/components/ParcelMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[520px] border border-gov-border bg-gov-surface flex items-center justify-center text-xs text-gov-secondary">
      Wczytywanie interaktywnej mapy...
    </div>
  ),
});

function Step1ParcelSearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTerytParam = searchParams.get("teryt");

  // Zakładka wyboru metody lokalizacji działki
  const [searchMode, setSearchMode] = useState<"map" | "teryt">(
    initialTerytParam ? "teryt" : "map"
  );

  // Wyszukiwarka miejscowości (dla wyboru na mapie)
  const [locationQuery, setLocationQuery] = useState<string>("");
  const [locationResults, setLocationResults] = useState<LocationSuggestion[]>(
    []
  );
  const [isSearchingLocation, setIsSearchingLocation] =
    useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocatingGps, setIsLocatingGps] = useState<boolean>(false);

  // Wyszukiwarka TERYT
  const [terytInput, setTerytInput] = useState<string>(initialTerytParam || "");
  const [isSearchingParcel, setIsSearchingParcel] = useState<boolean>(false);

  // Wybór kliknięciem na mapie
  const [isPickingParcel, setIsPickingParcel] = useState<boolean>(false);
  const [clickedPoint, setClickedPoint] = useState<[number, number] | null>(
    null
  );
  const [shouldFitBounds, setShouldFitBounds] = useState<boolean>(true);
  const [flyToTarget, setFlyToTarget] = useState<MapFlyTarget | null>(null);
  const flySeqRef = useRef<number>(0);

  // Wynik i błędy działki
  const [parcelError, setParcelError] = useState<string | null>(null);
  const [parcel, setParcel] = useState<ParcelSearchResponse | null>(null);
  const [landUseCheck, setLandUseCheck] = useState<LandUseCheckResult | null>(
    null
  );
  const [recentParcels, setRecentParcels] = useState<ParcelSearchResponse[]>(
    []
  );

  useEffect(() => {
    setRecentParcels(getRecentParcels());
    const cached = getStoredParcel(initialTerytParam);
    if (cached) {
      setParcel(cached);
      setTerytInput(cached.teryt);
      setShouldFitBounds(true);
    } else if (initialTerytParam) {
      performTerytSearch(initialTerytParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Podpowiedzi miejscowości z debounce 350 ms
  useEffect(() => {
    const trimmed = locationQuery.trim();
    if (trimmed.length < 2) {
      setLocationResults([]);
      setLocationError(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearchingLocation(true);
      setLocationError(null);
      try {
        const results = await searchLocations(trimmed);
        if (!cancelled) {
          setLocationResults(results);
        }
      } catch (err) {
        if (!cancelled) {
          setLocationResults([]);
          if (err instanceof ApiError) {
            setLocationError(err.message);
          }
        }
      } finally {
        if (!cancelled) {
          setIsSearchingLocation(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [locationQuery]);

  const flyMapTo = useCallback((lat: number, lon: number, zoom = 15) => {
    flySeqRef.current += 1;
    setFlyToTarget({ lat, lon, zoom, seq: flySeqRef.current });
  }, []);

  const handleSelectLocation = (loc: LocationSuggestion) => {
    setLocationQuery(loc.name);
    setLocationResults([]);
    setLocationError(null);
    setParcelError(null);
    flyMapTo(loc.lat, loc.lon, 15);
  };

  const handleLocationFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locationResults.length > 0) {
      handleSelectLocation(locationResults[0]);
      return;
    }

    const trimmed = locationQuery.trim();
    if (trimmed.length < 2) {
      setLocationError("Wpisz nazwę miejscowości lub gminy (min. 2 znaki).");
      return;
    }

    setIsSearchingLocation(true);
    setLocationError(null);
    try {
      const results = await searchLocations(trimmed);
      if (results.length > 0) {
        handleSelectLocation(results[0]);
      } else {
        setLocationError(
          `Nie znaleziono miejscowości „${trimmed}”. Spróbuj podać nazwę gminy lub powiatu.`
        );
      }
    } catch (err) {
      setLocationError(
        err instanceof ApiError
          ? err.message
          : "Nie udało się wyszukać miejscowości."
      );
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const handleUseMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError(
        "Twoja przeglądarka nie obsługuje automatycznej lokalizacji GPS."
      );
      return;
    }

    setIsLocatingGps(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocatingGps(false);
        flyMapTo(position.coords.latitude, position.coords.longitude, 16);
      },
      () => {
        setIsLocatingGps(false);
        setLocationError(
          "Nie uzyskano dostępu do lokalizacji GPS. Wyszukaj miejscowość ręcznie lub przybliż mapę."
        );
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const performTerytSearch = async (targetTeryt: string) => {
    const cleaned = targetTeryt.trim();
    if (!cleaned) {
      setParcelError(
        "Wpisz identyfikator działki TERYT w formacie WWPPGG_R.OOOO.NR_DZIAŁKI (np. 141201_1.0001.123/4)."
      );
      return;
    }

    setParcelError(null);
    setLandUseCheck(null);
    setIsSearchingParcel(true);

    try {
      const data = await searchParcelByTeryt(cleaned);
      const lu = await checkPointLandUse(data.center.lat, data.center.lon);
      setLandUseCheck(lu);
      setShouldFitBounds(true);
      setParcel(data);
      if (lu.canAnalyze) {
        saveStoredParcel(data);
        setRecentParcels(getRecentParcels());
      }
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
      setIsSearchingParcel(false);
    }
  };

  const handleTerytFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performTerytSearch(terytInput);
  };

  const handleMapClickParcel = useCallback(async (lat: number, lon: number) => {
    setParcelError(null);
    setLandUseCheck(null);
    setIsPickingParcel(true);
    setClickedPoint([lat, lon]);

    try {
      const [data, lu] = await Promise.all([
        searchParcelByPoint(lat, lon),
        checkPointLandUse(lat, lon),
      ]);
      setLandUseCheck(lu);
      setShouldFitBounds(false);
      setParcel(data);
      setTerytInput(data.teryt);
      if (lu.canAnalyze) {
        saveStoredParcel(data);
        setRecentParcels(getRecentParcels());
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setParcelError(err.message);
      } else {
        setParcelError(
          "Nie udało się odczytać działki w klikniętym punkcie. Spróbuj ponownie."
        );
      }
    } finally {
      setIsPickingParcel(false);
      setClickedPoint(null);
    }
  }, []);

  const handleProceedToStep2 = () => {
    if (!parcel) return;
    router.push(`/parametry?teryt=${encodeURIComponent(parcel.teryt)}`);
  };

  const handleSelectRecentParcel = (item: ParcelSearchResponse) => {
    setParcelError(null);
    setLandUseCheck(null);
    setShouldFitBounds(true);
    setParcel(item);
    setTerytInput(item.teryt);
    saveStoredParcel(item);
    setRecentParcels(getRecentParcels());
  };

  const handleRemoveRecentParcel = (teryt: string) => {
    removeRecentParcel(teryt);
    setRecentParcels(getRecentParcels());
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-gov-text">
      <AppHeader currentStep={1} teryt={parcel?.teryt} />

      <main className="flex-1 gov-container pt-8">
        {/* Nagłówek sekcji Kroku 1 */}
        <div className="border-b border-gov-border pb-5 mb-8">
          <p className="text-xs font-bold text-gov-blue mb-1">
            Krok 1 z 2 — Identyfikacja działki rolnej
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gov-navy">
            Wskaż swoją działkę na mapie lub podaj numer TERYT
          </h1>
          <p className="text-sm text-gov-secondary mt-1.5 max-w-3xl leading-relaxed">
            Znajdź miejscowość, przybliż mapę i kliknij bezpośrednio w swoje
            pole, aby automatycznie pobrać jego granice oraz powierzchnię.
            Możesz również wpisać znany identyfikator TERYT.
          </p>
        </div>

        {/* Główny układ: Lewa kolumna wyszukiwanie i tabela (5/12), Prawa kolumna mapa (7/12) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Lewa kolumna */}
          <div className="lg:col-span-5 space-y-6">
            {/* Zakładki wyboru metody: Mapa vs TERYT */}
            <div>
              <div
                role="tablist"
                aria-label="Sposób wyszukania działki"
                className="flex border-b border-gov-border mb-5"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={searchMode === "map"}
                  onClick={() => setSearchMode("map")}
                  className={`px-4 py-2.5 text-sm border-b-[3px] -mb-px transition-colors ${
                    searchMode === "map"
                      ? "border-gov-blue text-gov-blue font-bold"
                      : "border-transparent text-gov-secondary hover:text-gov-text"
                  }`}
                >
                  Wskaż na mapie
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={searchMode === "teryt"}
                  onClick={() => setSearchMode("teryt")}
                  className={`px-4 py-2.5 text-sm border-b-[3px] -mb-px transition-colors ${
                    searchMode === "teryt"
                      ? "border-gov-blue text-gov-blue font-bold"
                      : "border-transparent text-gov-secondary hover:text-gov-text"
                  }`}
                >
                  Wpisz numer TERYT
                </button>
              </div>
                  <h1>Test</h1>
              {searchMode === "map" ? (
                <div className="space-y-4">
                  <form
                    onSubmit={handleLocationFormSubmit}
                    className="space-y-2"
                  >
                    <label htmlFor="location-input" className="gov-label">
                      Wyszukaj miejscowość, wieś lub gminę
                    </label>
                    <span className="gov-hint">
                      Przeniesie widok mapy w okolicę Twojego gospodarstwa i
                      włączy granice działek.
                    </span>

                    <div className="relative">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          id="location-input"
                          type="text"
                          value={locationQuery}
                          onChange={(e) => setLocationQuery(e.target.value)}
                          placeholder="np. Nowa Wieś, Mińsk Mazowiecki"
                          autoComplete="off"
                          className="gov-input flex-1"
                        />
                        <button
                          type="submit"
                          disabled={isSearchingLocation}
                          className="gov-btn-primary shrink-0"
                        >
                          {isSearchingLocation ? "Szukam..." : "Pokaż na mapie"}
                        </button>
                      </div>

                      {/* Lista podpowiedzi miejscowości */}
                      {locationResults.length > 0 && (
                        <ul
                          role="listbox"
                          aria-label="Podpowiedzi miejscowości"
                          className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gov-border shadow-md divide-y divide-gov-border max-h-60 overflow-y-auto"
                        >
                          {locationResults.map((loc) => (
                            <li key={loc.id}>
                              <button
                                type="button"
                                onClick={() => handleSelectLocation(loc)}
                                className="w-full text-left px-3.5 py-2.5 hover:bg-gov-blue-light transition-colors"
                              >
                                <div className="text-sm font-bold text-gov-navy">
                                  {loc.name}
                                </div>
                                <div className="text-xs text-gov-secondary truncate">
                                  {loc.details}
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </form>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handleUseMyLocation}
                      disabled={isLocatingGps}
                      className="gov-btn-secondary text-xs py-2 px-3.5"
                    >
                      {isLocatingGps
                        ? "Ustalanie pozycji GPS..."
                        : "Przenieś mapę w moje położenie (GPS)"}
                    </button>
                  </div>

                  {locationError && (
                    <div role="alert" className="gov-callout-warning text-xs">
                      {locationError}
                    </div>
                  )}

                  {!parcel && !parcelError && (
                    <div className="gov-callout-info">
                      <div className="text-sm font-bold text-gov-navy">
                        Jak wybrać działkę bez numeru TERYT?
                      </div>
                      <ol className="list-decimal list-inside text-xs text-gov-secondary mt-1.5 space-y-1 leading-relaxed">
                        <li>
                          Wpisz nazwę miejscowości powyżej lub przybliż mapę do
                          swojej okolicy.
                        </li>
                        <li>
                          Gdy pojawią się cienkie granice działek, kliknij
                          bezpośrednio w swoje pole.
                        </li>
                        <li>
                          System automatycznie pobierze numer TERYT i
                          powierzchnię działki.
                        </li>
                      </ol>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleTerytFormSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="teryt-input" className="gov-label">
                      Identyfikator działki ewidencyjnej (TERYT)
                    </label>
                    <span className="gov-hint">
                      Wymagany format:{" "}
                      <code className="font-mono font-semibold text-gov-text">
                        WWPPGG_R.OOOO.NR_DZIAŁKI
                      </code>{" "}
                      (np. 141201_1.0001.123/4)
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
                          parcelError
                            ? "border-gov-danger focus:border-gov-danger"
                            : ""
                        }`}
                      />
                      <button
                        type="submit"
                        disabled={isSearchingParcel}
                        className="gov-btn-primary shrink-0"
                      >
                        {isSearchingParcel
                          ? "Wyszukiwanie..."
                          : "Szukaj działki"}
                      </button>
                    </div>
                  </div>

                  {!parcel && !parcelError && (
                    <div className="gov-callout-info">
                      <div className="text-sm font-bold text-gov-navy">
                        Skąd pobrać identyfikator działki TERYT?
                      </div>
                      <p className="text-xs text-gov-secondary mt-1 leading-relaxed">
                        Kod TERYT znajduje się we wniosku o dopłaty bezpośrednie
                        (eWniosekPlus ARiMR) lub na wypisie z rejestru gruntów.
                        Jeśli go nie znasz, przełącz na zakładkę{" "}
                        <button
                          type="button"
                          onClick={() => setSearchMode("map")}
                          className="text-gov-blue underline font-semibold"
                        >
                          Wskaż na mapie
                        </button>
                        .
                      </p>
                    </div>
                  )}
                </form>
              )}
            </div>

            {/* Komunikat błędu */}
            {parcelError && (
              <div role="alert" className="gov-callout-danger">
                <div className="text-sm font-bold text-gov-danger">
                  Nie udało się pobrać działki
                </div>
                <p className="text-sm text-gov-text mt-1 leading-relaxed">
                  {parcelError}
                </p>
              </div>
            )}

            {/* Potwierdzenie wybranej działki (wspólne dla kliknięcia na mapie i TERYT) */}
            {parcel && (
              <div className="pt-4 border-t border-gov-border space-y-5">
                {landUseCheck?.status === "water" ? (
                  <div role="alert" className="gov-callout-danger">
                    <div className="text-sm font-bold text-gov-danger">
                      Wybrana działka obejmuje wody powierzchniowe (jezioro,
                      staw lub rzekę)
                      {landUseCheck.featureName
                        ? ` — ${landUseCheck.featureName}`
                        : ""}
                    </div>
                    <p className="text-xs sm:text-sm text-gov-text mt-1 leading-relaxed">
                      Analiza agrotechniczna, retencji glebowej oraz nawadniania
                      upraw jest przeznaczona wyłącznie dla gruntów rolnych.
                      Kliknij na mapie w pole uprawne lub użytek zielony.
                    </p>
                  </div>
                ) : landUseCheck?.status === "forest" ? (
                  <div role="status" className="gov-callout-warning">
                    <div className="text-sm font-bold text-gov-navy">
                      Uwaga: wybrana działka obejmuje teren leśny lub
                      zadrzewiony
                      {landUseCheck.featureName
                        ? ` (${landUseCheck.featureName})`
                        : ""}
                    </div>
                    <p className="text-xs text-gov-text mt-1 leading-relaxed">
                      Według map pokrycia terenu w tym miejscu znajduje się las.
                      Jeśli część działki stanowi grunt rolny, możesz
                      kontynuować lub wskazać na mapie sąsiednie pole uprawne.
                    </p>
                  </div>
                ) : (
                  <div className="gov-callout-success">
                    <div className="text-sm font-bold text-gov-navy">
                      Wybrano działkę ewidencyjną
                    </div>
                    <p className="text-xs text-gov-secondary mt-0.5">
                      Sprawdź poniższe dane oraz zaznaczony obrys na mapie. Aby
                      wybrać inne pole, kliknij w inną działkę na mapie.
                    </p>
                  </div>
                )}

                <table className="gov-table border border-gov-border tabular-nums">
                  <tbody>
                    <tr>
                      <th className="w-2/5">Identyfikator TERYT</th>
                      <td className="font-mono font-bold">{parcel.teryt}</td>
                    </tr>
                    <tr>
                      <th>Województwo i powiat</th>
                      <td>
                        {parcel.voivodeship ? `woj. ${parcel.voivodeship}` : "—"}
                        {parcel.county ? `, ${parcel.county}` : ""}
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
                    disabled={landUseCheck?.canAnalyze === false}
                    onClick={handleProceedToStep2}
                    className="gov-btn-primary w-full py-3 text-base disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {landUseCheck?.canAnalyze === false
                      ? "Analiza niedostępna dla zbiorników wodnych — wybierz pole"
                      : "Dalej: Wybór uprawy i daty analizy (Krok 2)"}
                  </button>
                </div>
              </div>
            )}

            {/* Moje Gospodarstwo — Ostatnio wybierane działki */}
            {recentParcels.length > 0 && (
              <div className="pt-4 border-t border-gov-border space-y-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-sm font-bold text-gov-navy">
                    Moje gospodarstwo — ostatnio wybierane działki
                  </h2>
                  <span className="text-xs text-gov-secondary">
                    Szybkie przełączanie
                  </span>
                </div>

                <table className="gov-table border border-gov-border tabular-nums text-xs">
                  <thead>
                    <tr>
                      <th>TERYT / Gmina</th>
                      <th className="text-right">Powierzchnia</th>
                      <th className="text-right">Akcja</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentParcels.map((item) => {
                      const isCurrent = parcel?.teryt === item.teryt;
                      return (
                        <tr
                          key={item.teryt}
                          className={
                            isCurrent ? "bg-gov-blue-light" : "bg-white"
                          }
                        >
                          <td>
                            <div className="font-mono font-bold text-gov-navy">
                              {item.teryt}
                            </div>
                            <div className="text-[11px] text-gov-secondary">
                              {item.commune || "—"}, obręb{" "}
                              {item.precinct || "—"}
                            </div>
                          </td>
                          <td className="text-right font-mono font-semibold">
                            {item.area_ha} ha
                          </td>
                          <td className="text-right whitespace-nowrap space-x-2">
                            <button
                              type="button"
                              onClick={() => handleSelectRecentParcel(item)}
                              className="text-gov-blue hover:underline font-semibold"
                            >
                              {isCurrent ? "Na mapie" : "Wybierz"}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveRecentParcel(item.teryt)
                              }
                              className="text-gov-muted hover:text-gov-danger"
                              title="Usuń z listy"
                            >
                              Usuń
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Prawa kolumna: Interaktywna mapa satelitarna z warstwą KIEG */}
          <div className="lg:col-span-7 min-h-[540px] flex flex-col">
            <ParcelMap
              parcel={parcel}
              shouldFitBounds={shouldFitBounds}
              flyToTarget={flyToTarget}
              isPickingParcel={isPickingParcel}
              clickedPoint={clickedPoint}
              onMapClickParcel={handleMapClickParcel}
            />
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
