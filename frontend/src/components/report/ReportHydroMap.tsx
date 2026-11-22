"use client";

import React, { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  WMSTileLayer,
  GeoJSON,
  Circle,
  CircleMarker,
  Polyline,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { Diagnosis, ParcelSearchResponse } from "@/types/analysis";

interface ReportHydroMapProps {
  parcel: ParcelSearchResponse;
  diagnosis: Diagnosis;
}

function FitParcelAndBuffer({
  parcel,
  bufferRadiusM,
}: {
  parcel: ParcelSearchResponse;
  bufferRadiusM: number;
}) {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
      try {
        const layer = L.geoJSON(
          parcel.geometry as unknown as GeoJSON.GeoJsonObject
        );
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          // Rozszerzamy kadr, aby był widoczny również bufor rowu melioracyjnego
          const padRatio = bufferRadiusM > 200 ? 0.45 : 0.25;
          map.fitBounds(bounds.pad(padRatio), {
            padding: [24, 24],
            maxZoom: 17,
            animate: false,
          });
        }
      } catch {
        map.setView([parcel.center.lat, parcel.center.lon], 16);
      }
    }, 60);

    return () => clearTimeout(timer);
  }, [map, parcel, bufferRadiusM]);

  return null;
}

export default function ReportHydroMap({
  parcel,
  diagnosis,
}: ReportHydroMapProps) {
  const ditchDist =
    diagnosis.distance_to_ditch_m != null && diagnosis.distance_to_ditch_m <= 500
      ? diagnosis.distance_to_ditch_m
      : null;
  const waterwayCoords =
    Array.isArray(diagnosis.nearest_waterway_coords) &&
    diagnosis.nearest_waterway_coords.length >= 2
      ? diagnosis.nearest_waterway_coords
      : null;
  const waterwayPoint =
    Array.isArray(diagnosis.nearest_waterway_point) &&
    diagnosis.nearest_waterway_point.length === 2
      ? diagnosis.nearest_waterway_point
      : waterwayCoords
        ? waterwayCoords[Math.floor(waterwayCoords.length / 2)]
        : null;

  return (
    <div className="border border-gov-border bg-white">
      <div className="bg-gov-surface border-b border-gov-border px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-bold text-gov-navy">
          Szkic przestrzenny działki i strefy oddziaływania melioracyjnego
        </span>
        <span className="font-mono text-gov-secondary">
          Środek: {parcel.center.lat.toFixed(5)}°N,{" "}
          {parcel.center.lon.toFixed(5)}°E • Spadek:{" "}
          {diagnosis.slope_percent != null
            ? `${diagnosis.slope_percent.toFixed(1)}%`
            : "brak danych"}
          {diagnosis.aspect_direction
            ? ` (kierunek spływu: ${diagnosis.aspect_direction})`
            : ""}
        </span>
      </div>

      <div className="relative h-72 w-full bg-slate-200">
        <MapContainer
          center={[parcel.center.lat, parcel.center.lon]}
          zoom={16}
          zoomControl={true}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
          className="w-full h-full z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
            keepBuffer={2}
          />
          <WMSTileLayer
            url="https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/StandardResolution"
            layers="Raster"
            format="image/png"
            transparent={true}
            version="1.1.1"
            maxZoom={19}
            keepBuffer={2}
          />
          <WMSTileLayer
            url="https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaEwidencjiGruntow"
            layers="dzialki,numery_dzialek"
            format="image/png"
            transparent={true}
            version="1.1.1"
            maxZoom={19}
            opacity={0.85}
            keepBuffer={2}
          />

          <FitParcelAndBuffer
            parcel={parcel}
            bufferRadiusM={ditchDist ?? 150}
          />

          {/* Okrąg odległości do najbliższego rowu (gdy brak geometrii linii cieku) */}
          {ditchDist != null && !waterwayCoords && (
            <Circle
              center={[parcel.center.lat, parcel.center.lon]}
              radius={ditchDist}
              pathOptions={{
                color: "#00E5FF",
                weight: 3.5,
                dashArray: "8 5",
                fillColor: "#00E5FF",
                fillOpacity: 0.15,
              }}
            />
          )}

          {/* Faktyczna linia najbliższego cieku / rowu (gdy dostarczona przez API) */}
          {waterwayCoords && (
            <Polyline
              positions={waterwayCoords}
              pathOptions={{
                color: "#00B8D4",
                weight: 4.5,
                opacity: 0.95,
              }}
            >
              <Tooltip sticky>
                Najbliższy ciek / rów melioracyjny
                {ditchDist != null ? ` (${Math.round(ditchDist)} m)` : ""}
              </Tooltip>
            </Polyline>
          )}

          {/* Proponowane miejsce spowolnienia odpływu / zastawki */}
          {waterwayPoint && (
            <CircleMarker
              center={waterwayPoint}
              radius={7}
              pathOptions={{
                color: "#0B2240",
                weight: 2,
                fillColor: "#00E5FF",
                fillOpacity: 0.95,
              }}
            >
              <Tooltip direction="top" offset={[0, -6]}>
                Proponowane miejsce spowolnienia odpływu / zastawki
              </Tooltip>
            </CircleMarker>
          )}

          {/* Obrys badanej działki */}
          <GeoJSON
            key={parcel.teryt}
            data={parcel.geometry as unknown as GeoJSON.GeoJsonObject}
            style={() => ({
              color: "#FFBF47",
              weight: 3.5,
              opacity: 1,
              fillColor: "#156534",
              fillOpacity: 0.28,
            })}
          />
        </MapContainer>
      </div>

      <div className="bg-gov-surface border-t border-gov-border px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-gov-secondary">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3.5 h-3 border-2 border-[#FFBF47] bg-[#156534]/30" />
            <span>
              Badana działka {parcel.teryt} ({parcel.area_ha} ha)
            </span>
          </span>
          {ditchDist != null ? (
            <span className="inline-flex items-center gap-1.5">
              <span
                className={
                  waterwayCoords
                    ? "inline-block w-4 h-1 bg-[#00B8D4]"
                    : "inline-block w-3.5 h-3 border-2 border-dashed border-[#00B8D4] bg-[#00E5FF]/25"
                }
              />
              <span>
                {waterwayCoords
                  ? `Najbliższy ciek / rów melioracyjny (${Math.round(ditchDist)} m — strefa retencji korytowej)`
                  : `Promień do najbliższego rowu melioracyjnego (${Math.round(ditchDist)} m — strefa retencji korytowej)`}
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-gov-secondary">
              <span className="inline-block w-3 h-3 rounded-full border border-gov-muted bg-gov-surface" />
              <span>
                Brak cieków / rowów melioracyjnych w buforze 500 m
              </span>
            </span>
          )}
          {diagnosis.nearest_river && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#0052A5]" />
              <span>
                Najbliższa rzeka IMGW: <strong>{diagnosis.nearest_river}</strong>
                {diagnosis.river_distance_m != null && ` (${(diagnosis.river_distance_m / 1000).toFixed(1)} km)`}
                {diagnosis.water_level_cm != null && ` • stan wody: ${diagnosis.water_level_cm} cm`}
              </span>
            </span>
          )}
        </div>
        <span>Podkład: Ortofotomapa i KIEG GUGiK</span>
      </div>
    </div>
  );
}
