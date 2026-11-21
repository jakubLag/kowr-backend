"use client";

import React, { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
  ZoomControl,
} from "react-leaflet";
import L from "leaflet";
import { ParcelSearchResponse } from "@/types/analysis";

interface ParcelMapProps {
  parcel: ParcelSearchResponse | null;
}

const POLAND_CENTER: [number, number] = [52.0693, 19.4803];
const DEFAULT_ZOOM = 6;

function MapBoundsController({
  parcel,
}: {
  parcel: ParcelSearchResponse | null;
}) {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 50);

    if (!parcel || !parcel.geometry) {
      map.setView(POLAND_CENTER, DEFAULT_ZOOM, { animate: true });
      return () => clearTimeout(timer);
    }

    try {
      const geoJsonLayer = L.geoJSON(parcel.geometry as GeoJSON.GeoJsonObject);
      const bounds = geoJsonLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [48, 48],
          maxZoom: 17,
          animate: true,
          duration: 0.8,
        });
      } else if (parcel.center) {
        map.setView(parcel.center, 16, { animate: true });
      }
    } catch {
      if (parcel.center) {
        map.setView(parcel.center, 16, { animate: true });
      }
    }

    return () => clearTimeout(timer);
  }, [parcel, map]);

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

export default function ParcelMap({ parcel }: ParcelMapProps) {
  const [mapMode, setMapMode] = useState<"hybrid" | "satellite" | "osm">(
    "hybrid"
  );

  const handleRecenter = () => {
    window.dispatchEvent(new CustomEvent("kowr-recenter-map"));
  };

  return (
    <div className="w-full h-full flex flex-col border border-gov-border bg-white">
      {/* Pasek sterowania mapą */}
      <div className="bg-gov-surface border-b border-gov-border px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="text-gov-text">
          <span className="font-bold text-gov-navy">Mapa satelitarna</span>
          {parcel ? (
            <span className="ml-2 text-gov-secondary">
              — działka <strong className="font-mono text-gov-text">{parcel.teryt}</strong> ({parcel.area_ha} ha)
            </span>
          ) : (
            <span className="ml-2 text-gov-secondary">
              — wyszukaj działkę, aby przybliżyć widok do jej granic
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {parcel && (
            <button
              type="button"
              onClick={handleRecenter}
              className="px-2.5 py-1 bg-white hover:bg-gov-blue-light text-gov-blue border border-gov-blue rounded-[2px] font-semibold transition-colors"
            >
              Wyśrodkuj na działce
            </button>
          )}
          <div
            role="group"
            aria-label="Wybór warstwy mapy"
            className="inline-flex border border-gov-border bg-white rounded-[2px] overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setMapMode("hybrid")}
              className={`px-2.5 py-1 font-medium border-r border-gov-border transition-colors ${
                mapMode === "hybrid"
                  ? "bg-gov-blue text-white font-semibold"
                  : "text-gov-text hover:bg-gov-surface"
              }`}
            >
              Ortofotomapa z opisami
            </button>
            <button
              type="button"
              onClick={() => setMapMode("satellite")}
              className={`px-2.5 py-1 font-medium border-r border-gov-border transition-colors ${
                mapMode === "satellite"
                  ? "bg-gov-blue text-white font-semibold"
                  : "text-gov-text hover:bg-gov-surface"
              }`}
            >
              Ortofotomapa
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

      {/* Obszar roboczy mapy */}
      <div className="relative flex-1 min-h-[440px] w-full bg-slate-200">
        <MapContainer
          center={parcel?.center || POLAND_CENTER}
          zoom={parcel ? 16 : DEFAULT_ZOOM}
          zoomControl={false}
          scrollWheelZoom={true}
          style={{ height: "100%", minHeight: "440px", width: "100%" }}
          className="w-full h-full z-0"
        >
          <ZoomControl position="bottomright" />

          {(mapMode === "satellite" || mapMode === "hybrid") && (
            <TileLayer
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
          )}

          {mapMode === "hybrid" && (
            <TileLayer
              attribution=""
              url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
              opacity={0.9}
            />
          )}

          {mapMode === "osm" && (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
          )}

          <MapBoundsController parcel={parcel} />
          <RecenterListener parcel={parcel} />

          {parcel && parcel.geometry && (
            <GeoJSON
              key={`${parcel.teryt}-${mapMode}`}
              data={parcel.geometry as unknown as GeoJSON.GeoJsonObject}
              style={() => ({
                color: "#FFBF47",
                weight: 3,
                opacity: 1,
                fillColor: "#0052A5",
                fillOpacity: 0.25,
              })}
              onEachFeature={(_feature, layer) => {
                layer.bindTooltip(
                  `<div style="font-family: Lato, sans-serif; padding: 2px 4px;">
                    <div style="font-weight: 700; color: #0B2240; font-size: 12px;">Działka ${parcel.teryt}</div>
                    <div style="color: #1B1B1B; font-size: 11px;">Powierzchnia: <b>${parcel.area_ha} ha</b></div>
                    <div style="color: #4A5568; font-size: 11px;">Obręb: ${parcel.precinct}, gm. ${parcel.commune}</div>
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
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block w-4 h-3 border-2 border-[#FFBF47] bg-[#0052A5]/30"
          />
          <span>
            {parcel
              ? `Granica działki ewidencyjnej ${parcel.teryt} (środek: ${parcel.center[0].toFixed(4)}°N, ${parcel.center[1].toFixed(4)}°E)`
              : "Brak zaznaczonej działki na mapie"}
          </span>
        </div>
        <span>Źródło geometrii: GUGiK ULDK</span>
      </div>
    </div>
  );
}
