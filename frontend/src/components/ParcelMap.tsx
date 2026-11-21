"use client";

import React, { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  WMSTileLayer,
  GeoJSON,
  CircleMarker,
  useMap,
  useMapEvents,
  ZoomControl,
} from "react-leaflet";
import L from "leaflet";
import { ParcelSearchResponse } from "@/types/analysis";

export interface MapFlyTarget {
  lat: number;
  lon: number;
  zoom?: number;
  seq: number;
}

interface ParcelMapProps {
  parcel: ParcelSearchResponse | null;
  shouldFitBounds?: boolean;
  flyToTarget?: MapFlyTarget | null;
  isPickingParcel?: boolean;
  clickedPoint?: [number, number] | null;
  onMapClickParcel?: (lat: number, lon: number) => void;
}

const POLAND_CENTER: [number, number] = [52.0693, 19.4803];
const DEFAULT_ZOOM = 6;
const PARCEL_CLICK_MIN_ZOOM = 14;
const KIEG_OVERLAY_MIN_ZOOM = 15;

function MapController({
  parcel,
  shouldFitBounds,
  flyToTarget,
  isPickingParcel,
  onZoomChange,
  onMapClickParcel,
  onZoomedInHint,
}: {
  parcel: ParcelSearchResponse | null;
  shouldFitBounds: boolean;
  flyToTarget: MapFlyTarget | null;
  isPickingParcel: boolean;
  onZoomChange: (zoom: number) => void;
  onMapClickParcel?: (lat: number, lon: number) => void;
  onZoomedInHint: () => void;
}) {
  const map = useMap();

  useMapEvents({
    zoomend: () => {
      onZoomChange(map.getZoom());
    },
    click: (e) => {
      if (isPickingParcel) return;
      const currentZoom = map.getZoom();

      if (currentZoom < PARCEL_CLICK_MIN_ZOOM) {
        map.flyTo(e.latlng, KIEG_OVERLAY_MIN_ZOOM, {
          animate: true,
          duration: 0.7,
        });
        onZoomedInHint();
        return;
      }

      if (onMapClickParcel) {
        onMapClickParcel(e.latlng.lat, e.latlng.lng);
      }
    },
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
      onZoomChange(map.getZoom());
    }, 50);
    return () => clearTimeout(timer);
  }, [map, onZoomChange]);

  // Przelot do wybranej miejscowości lub pozycji GPS
  useEffect(() => {
    if (!flyToTarget) return;
    map.flyTo([flyToTarget.lat, flyToTarget.lon], flyToTarget.zoom ?? 15, {
      animate: true,
      duration: 0.9,
    });
  }, [flyToTarget, map]);

  // Dopasowanie widoku do geometrii działki
  useEffect(() => {
    if (!parcel || !parcel.geometry) return;

    try {
      const geoJsonLayer = L.geoJSON(parcel.geometry as GeoJSON.GeoJsonObject);
      const bounds = geoJsonLayer.getBounds();
      if (!bounds.isValid()) return;

      if (shouldFitBounds) {
        map.fitBounds(bounds, {
          padding: [48, 48],
          maxZoom: 17,
          animate: true,
          duration: 0.8,
        });
      } else if (!map.getBounds().contains(bounds)) {
        // Przy wyborze kliknięciem nie zmieniamy agresywnie skali, tylko delikatnie przesuwamy kadr jeśli działka wystaje
        map.panTo(bounds.getCenter(), { animate: true, duration: 0.5 });
      }
    } catch {
      if (shouldFitBounds && parcel.center) {
        map.setView([parcel.center.lat, parcel.center.lon], 16, {
          animate: true,
        });
      }
    }
  }, [parcel, shouldFitBounds, map]);

  return null;
}

function RecenterListener({ parcel }: { parcel: ParcelSearchResponse | null }) {
  const map = useMap();

  useEffect(() => {
    const handler = () => {
      if (!parcel?.geometry) return;
      try {
        const layer = L.geoJSON(parcel.geometry as GeoJSON.GeoJsonObject);
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, {
            padding: [48, 48],
            maxZoom: 17,
            animate: true,
          });
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener("kowr-recenter-map", handler);
    return () => window.removeEventListener("kowr-recenter-map", handler);
  }, [map, parcel]);

  return null;
}

export default function ParcelMap({
  parcel,
  shouldFitBounds = true,
  flyToTarget = null,
  isPickingParcel = false,
  clickedPoint = null,
  onMapClickParcel,
}: ParcelMapProps) {
  const [mapMode, setMapMode] = useState<"gugik" | "hybrid" | "osm">("gugik");
  const [showCadastralGrid, setShowCadastralGrid] = useState<boolean>(true);
  const [showEdoDroughtLayer, setShowEdoDroughtLayer] =
    useState<boolean>(false);
  const [currentZoom, setCurrentZoom] = useState<number>(
    parcel ? 16 : DEFAULT_ZOOM
  );
  const [justZoomedHint, setJustZoomedHint] = useState<boolean>(false);

  // Rejestracja Service Workera cachującego kafelki mapy (GUGiK Orto, KIEG, Esri, OSM)
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw-tiles.js").catch(() => {
        // ignore registration errors in unsupported environments
      });
    }
  }, []);

  const handleRecenter = () => {
    window.dispatchEvent(new CustomEvent("kowr-recenter-map"));
  };

  const handleZoomChange = (zoom: number) => {
    setCurrentZoom(zoom);
    if (zoom >= PARCEL_CLICK_MIN_ZOOM && justZoomedHint) {
      setTimeout(() => setJustZoomedHint(false), 4000);
    }
  };

  const canPickDirectly = currentZoom >= PARCEL_CLICK_MIN_ZOOM;
  const kiegVisible = showCadastralGrid && currentZoom >= KIEG_OVERLAY_MIN_ZOOM;

  return (
    <div className="w-full h-full flex flex-col border border-gov-border bg-white">
      {/* Pasek sterowania warstwami mapy */}
      <div className="bg-gov-surface border-b border-gov-border px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-3 text-gov-text">
          <span className="font-bold text-gov-navy">Interaktywna mapa</span>
          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-gov-text">
            <input
              type="checkbox"
              checked={showCadastralGrid}
              onChange={(e) => setShowCadastralGrid(e.target.checked)}
              className="w-3.5 h-3.5 accent-gov-blue"
            />
            <span>Granice działek (KIEG)</span>
          </label>
          <label
            className="inline-flex items-center gap-1.5 cursor-pointer select-none text-gov-text"
            title="Europejskie Obserwatorium Suszy (Copernicus EDO — wskaźnik CDI)"
          >
            <input
              type="checkbox"
              checked={showEdoDroughtLayer}
              onChange={(e) => setShowEdoDroughtLayer(e.target.checked)}
              className="w-3.5 h-3.5 accent-gov-blue"
            />
            <span>Tło suszowe Europy (EDO Copernicus WMS)</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {parcel && (
            <button
              type="button"
              onClick={handleRecenter}
              className="px-2.5 py-1 bg-white hover:bg-gov-blue-light text-gov-blue border border-gov-blue rounded-[2px] font-semibold transition-colors"
            >
              Wyśrodkuj
            </button>
          )}
          <div
            role="group"
            aria-label="Wybór podkładu mapy"
            className="inline-flex border border-gov-border bg-white rounded-[2px] overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setMapMode("gugik")}
              className={`px-2.5 py-1 font-medium border-r border-gov-border transition-colors ${
                mapMode === "gugik"
                  ? "bg-gov-blue text-white font-semibold"
                  : "text-gov-text hover:bg-gov-surface"
              }`}
            >
              Ortofotomapa GUGiK
            </button>
            <button
              type="button"
              onClick={() => setMapMode("hybrid")}
              className={`px-2.5 py-1 font-medium border-r border-gov-border transition-colors ${
                mapMode === "hybrid"
                  ? "bg-gov-blue text-white font-semibold"
                  : "text-gov-text hover:bg-gov-surface"
              }`}
            >
              Satelita (Esri)
            </button>
            <button
              type="button"
              onClick={() => setMapMode("osm")}
              className={`px-2.5 py-1 font-medium transition-colors ${
                mapMode === "osm"
                  ? "bg-gov-blue text-white font-semibold"
                  : "text-gov-text hover:bg-gov-surface"
              }`}
            >
              Mapa drogowa
            </button>
          </div>
        </div>
      </div>

      {/* Pasek podpowiedzi interakcji nad mapą */}
      <div
        className={`px-4 py-2 border-b border-gov-border text-xs flex flex-wrap items-center justify-between gap-2 ${
          isPickingParcel
            ? "bg-gov-blue-light text-gov-navy font-semibold"
            : kiegVisible
              ? "bg-gov-success-bg text-gov-navy"
              : "bg-white text-gov-secondary"
        }`}
      >
        <span>
          {isPickingParcel
            ? "Pobieranie danych działki dla wskazanego punktu na mapie..."
            : justZoomedHint
              ? "Przybliżono mapę do poziomu pól — kliknij teraz bezpośrednio w swoją działkę, aby ją wybrać."
              : kiegVisible
                ? "Granice działek są aktywne. Kliknij w swoje pole na mapie, aby je zaznaczyć."
                : canPickDirectly
                  ? "Możesz kliknąć w pole, aby wybrać działkę (przybliż jeszcze o 1 poziom, aby zobaczyć granice KIEG)."
                  : "Wyszukaj miejscowość po lewej stronie lub kliknij wybrany obszar na mapie, aby przybliżyć widok do poziomu pól."}
        </span>
        <span className="font-mono text-[11px] text-gov-muted tabular-nums shrink-0">
          Przybliżenie: {currentZoom} / 19
        </span>
      </div>

      {/* Obszar roboczy mapy */}
      <div
        className={`relative flex-1 min-h-[460px] w-full bg-slate-200 ${
          isPickingParcel
            ? "cursor-wait"
            : canPickDirectly
              ? "[&_.leaflet-container]:cursor-crosshair"
              : "[&_.leaflet-container]:cursor-zoom-in"
        }`}
      >
        <MapContainer
          center={
            parcel?.center
              ? [parcel.center.lat, parcel.center.lon]
              : POLAND_CENTER
          }
          zoom={parcel ? 16 : DEFAULT_ZOOM}
          zoomControl={false}
          scrollWheelZoom={true}
          style={{ height: "100%", minHeight: "460px", width: "100%" }}
          className="w-full h-full z-0"
        >
          <ZoomControl position="bottomright" />

          {/* Podkład bazowy: szybkie pre-renderowane kafelki satelitarne Esri */}
          {(mapMode === "gugik" || mapMode === "hybrid") && (
            <TileLayer
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
              keepBuffer={3}
            />
          )}

          {/* Polska Ortofotomapa GUGiK — włączana od poziomu pól (zoom >= 15), aby zoom-out działał błyskawicznie */}
          {mapMode === "gugik" && currentZoom >= 15 && (
            <WMSTileLayer
              url="https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/StandardResolution"
              layers="Raster"
              format="image/png"
              transparent={true}
              version="1.1.1"
              maxZoom={19}
              keepBuffer={2}
              attribution="Ortofotomapa &copy; GUGiK"
            />
          )}

          {/* Opisy miejscowości na trybie Satelita (Esri) oraz GUGiK przy oddaleniu */}
          {(mapMode === "hybrid" ||
            (mapMode === "gugik" && currentZoom < 15)) && (
            <TileLayer
              attribution=""
              url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
              opacity={0.9}
              keepBuffer={3}
            />
          )}

          {/* Mapa drogowa OSM */}
          {mapMode === "osm" && (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
              keepBuffer={3}
            />
          )}

          {/* Warstwa tła suszowego Europy (Copernicus EDO — Combined Drought Indicator WMS) */}
          {showEdoDroughtLayer && (
            <WMSTileLayer
              url="https://drought.emergency.copernicus.eu/api/wms"
              layers="cdiad"
              format="image/png"
              transparent={true}
              version="1.1.1"
              maxZoom={19}
              opacity={0.55}
              attribution="EDO Combined Drought Indicator &copy; Copernicus EMS"
            />
          )}

          {/* Warstwa granic i numerów działek KIEG WMS (aktywna od zoom >= 15) */}
          {kiegVisible && (
            <WMSTileLayer
              url="https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaEwidencjiGruntow"
              layers="dzialki,numery_dzialek"
              format="image/png"
              transparent={true}
              version="1.1.1"
              maxZoom={19}
              opacity={0.9}
              keepBuffer={2}
              attribution="Ewidencja gruntów (KIEG) &copy; GUGiK"
            />
          )}

          <MapController
            parcel={parcel}
            shouldFitBounds={shouldFitBounds}
            flyToTarget={flyToTarget}
            isPickingParcel={isPickingParcel}
            onZoomChange={handleZoomChange}
            onMapClickParcel={onMapClickParcel}
            onZoomedInHint={() => setJustZoomedHint(true)}
          />
          <RecenterListener parcel={parcel} />

          {/* Tymczasowy znacznik w miejscu kliknięcia podczas ładowania działki */}
          {isPickingParcel && clickedPoint && (
            <CircleMarker
              center={clickedPoint}
              radius={7}
              pathOptions={{
                color: "#0052A5",
                weight: 2.5,
                fillColor: "#FFFFFF",
                fillOpacity: 0.9,
              }}
            />
          )}

          {/* Wybrana działka jako dokładny obrys wektorowy GeoJSON */}
          {parcel && parcel.geometry && (
            <GeoJSON
              key={`${parcel.teryt}-${mapMode}`}
              data={parcel.geometry as unknown as GeoJSON.GeoJsonObject}
              style={() => ({
                color: "#FFBF47",
                weight: 3.5,
                opacity: 1,
                fillColor: "#0052A5",
                fillOpacity: 0.28,
              })}
              onEachFeature={(_feature, layer) => {
                layer.bindTooltip(
                  `<div style="font-family: Lato, sans-serif; padding: 2px 4px;">
                    <div style="font-weight: 700; color: #0B2240; font-size: 12px;">Działka ${parcel.teryt}</div>
                    <div style="color: #1B1B1B; font-size: 11px;">Powierzchnia: <b>${parcel.area_ha} ha</b></div>
                    <div style="color: #4A5568; font-size: 11px;">Obręb: ${parcel.precinct || "—"}, gm. ${parcel.commune || "—"}</div>
                  </div>`,
                  {
                    sticky: true,
                    direction: "top",
                  }
                );
              }}
            />
          )}
        </MapContainer>
      </div>

      {/* Stopka legendy mapy */}
      <div className="bg-gov-surface border-t border-gov-border px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gov-secondary">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block w-4 h-3 border-2 border-[#FFBF47] bg-[#0052A5]/30"
            />
            <span>
              {parcel
                ? `Wybrana działka: ${parcel.teryt} (${parcel.area_ha} ha)`
                : "Wybrana działka"}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block w-4 h-3 border border-slate-500 bg-transparent"
            />
            <span>Granice ewidencyjne KIEG (od przybliżenia 15)</span>
          </span>
          {showEdoDroughtLayer && (
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block w-4 h-3 border border-amber-700 bg-amber-400/60"
              />
              <span>EDO CDI (Copernicus): tło suszowe Europy</span>
            </span>
          )}
        </div>
        <span>
          Źródła: GUGiK (Ortofotomapa, KIEG, ULDK)
          {showEdoDroughtLayer ? ", Copernicus EDO WMS" : ""}
        </span>
      </div>
    </div>
  );
}
