import { NextRequest, NextResponse } from "next/server";
import { LandUseCheckResult } from "@/types/analysis";

const WATER_TYPES = new Set([
  "water",
  "lake",
  "pond",
  "reservoir",
  "basin",
  "river",
  "riverbank",
  "stream",
  "canal",
  "oxbow",
  "lagoon",
  "fishpond",
  "moat",
  "bay",
  "strait",
  "sea",
  "ocean",
]);

const FOREST_TYPES = new Set(["forest", "wood", "forestry"]);

function isPointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersect =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function isPointInGeoJson(
  lon: number,
  lat: number,
  geojson: { type?: string; coordinates?: unknown } | null | undefined
): boolean {
  if (!geojson || !geojson.type || !geojson.coordinates) return false;
  if (geojson.type === "Polygon") {
    const coords = geojson.coordinates as number[][][];
    if (!coords.length) return false;
    return isPointInRing(lon, lat, coords[0]);
  }
  if (geojson.type === "MultiPolygon") {
    const coords = geojson.coordinates as number[][][][];
    return coords.some((poly) => poly.length > 0 && isPointInRing(lon, lat, poly[0]));
  }
  return false;
}

async function checkViaNominatimNatural(
  lat: number,
  lon: number
): Promise<LandUseCheckResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("zoom", "18");
    url.searchParams.set("layer", "natural");
    url.searchParams.set("polygon_geojson", "1");

    const resp = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "KOWR-Water-Support-HackNation2026/1.0",
        "Accept-Language": "pl",
      },
      next: { revalidate: 300 },
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data || data.error) return null;

    const type = String(data.type || "").toLowerCase();
    const addresstype = String(data.addresstype || "").toLowerCase();
    const name = data.name ? String(data.name) : null;

    // Weryfikujemy, czy kliknięty punkt faktycznie leży wewnątrz poligonu danego obiektu naturalnego
    const insidePolygon = isPointInGeoJson(lon, lat, data.geojson);
    if (!insidePolygon) {
      return null;
    }

    if (WATER_TYPES.has(type) || WATER_TYPES.has(addresstype)) {
      return {
        status: "water",
        label: "Wody powierzchniowe (morze, jezioro, staw lub rzeka)",
        featureName: name,
        canAnalyze: false,
      };
    }

    if (FOREST_TYPES.has(type) || FOREST_TYPES.has(addresstype)) {
      return {
        status: "forest",
        label: "Teren leśny lub zadrzewiony",
        featureName: name,
        canAnalyze: true,
      };
    }

    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function checkViaOverpassFast(
  lat: number,
  lon: number
): Promise<LandUseCheckResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  const query = `
    [out:json][timeout:2];
    is_in(${lat},${lon})->.a;
    (
      area.a["natural"~"^(water|bay|strait|wood)$"];
      area.a["place"~"^(sea|ocean)$"];
      area.a["waterway"~"^(riverbank|river|canal|dock)$"];
      area.a["landuse"~"^(reservoir|basin|forest)$"];
      way(around:15,${lat},${lon})["natural"="water"];
      way(around:15,${lat},${lon})["landuse"~"^(reservoir|basin)$"];
    );
    out tags 5;
  `;

  try {
    const resp = await fetch(
      "https://overpass.private.coffee/api/interpreter",
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "KOWR-Water-Support-HackNation2026/1.0",
        },
        body: `data=${encodeURIComponent(query)}`,
      }
    );

    if (!resp.ok) return null;
    const data = await resp.json();
    const elements = Array.isArray(data.elements) ? data.elements : [];

    for (const el of elements) {
      const tags = el.tags || {};
      const natural = String(tags.natural || "").toLowerCase();
      const place = String(tags.place || "").toLowerCase();
      const landuse = String(tags.landuse || "").toLowerCase();
      const waterway = String(tags.waterway || "").toLowerCase();
      const water = String(tags.water || "").toLowerCase();
      const name = tags.name ? String(tags.name) : null;

      if (
        natural === "water" ||
        natural === "bay" ||
        natural === "strait" ||
        place === "sea" ||
        place === "ocean" ||
        landuse === "reservoir" ||
        landuse === "basin" ||
        Boolean(water) ||
        Boolean(waterway)
      ) {
        return {
          status: "water",
          label: "Wody powierzchniowe (morze, jezioro, staw lub ciek wodny)",
          featureName: name,
          canAnalyze: false,
        };
      }
    }

    for (const el of elements) {
      const tags = el.tags || {};
      const natural = String(tags.natural || "").toLowerCase();
      const landuse = String(tags.landuse || "").toLowerCase();
      const name = tags.name ? String(tags.name) : null;

      if (natural === "wood" || landuse === "forest") {
        return {
          status: "forest",
          label: "Teren leśny lub zadrzewiony",
          featureName: name,
          canAnalyze: true,
        };
      }
    }

    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest) {
  const latStr = request.nextUrl.searchParams.get("lat");
  const lonStr = request.nextUrl.searchParams.get("lon");
  const lat = Number(latStr);
  const lon = Number(lonStr);

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return NextResponse.json(
      { detail: "Nieprawidłowe współrzędne punktu." },
      { status: 400 }
    );
  }

  const [nominatimRes, overpassRes] = await Promise.all([
    checkViaNominatimNatural(lat, lon),
    checkViaOverpassFast(lat, lon),
  ]);

  if (nominatimRes?.status === "water") {
    return NextResponse.json(nominatimRes);
  }
  if (overpassRes?.status === "water") {
    return NextResponse.json(overpassRes);
  }

  if (nominatimRes?.status === "forest") {
    return NextResponse.json(nominatimRes);
  }
  if (overpassRes?.status === "forest") {
    return NextResponse.json(overpassRes);
  }

  const defaultResult: LandUseCheckResult = {
    status: "agricultural",
    label: "Grunt rolny / teren otwarty",
    featureName: null,
    canAnalyze: true,
  };

  return NextResponse.json(defaultResult);
}
