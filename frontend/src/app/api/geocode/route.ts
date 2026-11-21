import { NextRequest, NextResponse } from "next/server";
import { LocationSuggestion } from "@/types/analysis";

interface NominatimItem {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  address?: {
    village?: string;
    town?: string;
    city?: string;
    municipality?: string;
    county?: string;
    state?: string;
  };
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("countrycodes", "pl");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "6");
    url.searchParams.set("q", query);

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "KOWR-Water-Support-HackNation2026/1.0 (gov.pl prototype)",
        "Accept-Language": "pl",
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { detail: "Usługa wyszukiwania miejscowości jest chwilowo niedostępna." },
        { status: 502 }
      );
    }

    const items = (await response.json()) as NominatimItem[];

    const results: LocationSuggestion[] = items.map((item) => {
      const addr = item.address || {};
      const primaryName =
        item.name ||
        addr.village ||
        addr.town ||
        addr.city ||
        item.display_name.split(",")[0];

      const detailParts = [
        addr.municipality,
        addr.county,
        addr.state,
      ].filter(Boolean);

      return {
        id: String(item.place_id),
        name: primaryName,
        details:
          detailParts.length > 0
            ? detailParts.join(", ")
            : item.display_name,
        lat: Number(item.lat),
        lon: Number(item.lon),
      };
    });

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { detail: "Nie udało się połączyć z usługą wyszukiwania miejscowości." },
      { status: 504 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
