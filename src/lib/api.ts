import {
  AnalyzeRequest,
  AnalysisResponse,
  CropInfo,
  LocationSuggestion,
  ParcelSearchResponse,
} from "@/types/analysis";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number = 400) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function searchParcelByTeryt(
  teryt: string
): Promise<ParcelSearchResponse> {
  const cleanTeryt = teryt.trim();

  let response: Response;
  try {
    response = await fetch(
      `${API_BASE_URL}/api/parcel/search?teryt=${encodeURIComponent(cleanTeryt)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      }
    );
  } catch {
    throw new ApiError(
      `Brak połączenia z serwerem API (${API_BASE_URL}). Upewnij się, że backend jest uruchomiony.`,
      503
    );
  }

  if (response.status === 404) {
    const errBody = await response.json().catch(() => null);
    throw new ApiError(
      errBody?.detail ||
        `Nie znaleziono działki o identyfikatorze TERYT: ${cleanTeryt}. Sprawdź poprawność numeru.`,
      404
    );
  }

  if (!response.ok) {
    const errBody = await response.json().catch(() => null);
    throw new ApiError(
      errBody?.detail || `Błąd serwera API (${response.status}).`,
      response.status
    );
  }

  return response.json();
}

export async function searchParcelByPoint(
  lat: number,
  lon: number
): Promise<ParcelSearchResponse> {
  let response: Response;
  try {
    response = await fetch(
      `${API_BASE_URL}/api/parcel/by-point?lat=${encodeURIComponent(lat.toFixed(6))}&lon=${encodeURIComponent(lon.toFixed(6))}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      }
    );
  } catch {
    throw new ApiError(
      `Brak połączenia z serwerem API (${API_BASE_URL}). Nie można pobrać działki dla wybranego punktu na mapie.`,
      503
    );
  }

  if (response.status === 404) {
    const errBody = await response.json().catch(() => null);
    throw new ApiError(
      errBody?.detail ||
        "W klikniętym punkcie nie odnaleziono działki ewidencyjnej. Kliknij bezpośrednio wewnątrz granic pola.",
      404
    );
  }

  if (!response.ok) {
    const errBody = await response.json().catch(() => null);
    throw new ApiError(
      errBody?.detail || `Błąd serwera API (${response.status}).`,
      response.status
    );
  }

  return response.json();
}

export async function searchLocations(
  query: string
): Promise<LocationSuggestion[]> {
  const cleaned = query.trim();
  if (cleaned.length < 2) return [];

  const response = await fetch(
    `/api/geocode?q=${encodeURIComponent(cleaned)}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errBody = await response.json().catch(() => null);
    throw new ApiError(
      errBody?.detail || "Nie udało się wyszukać miejscowości.",
      response.status
    );
  }

  const data = (await response.json()) as { results?: LocationSuggestion[] };
  return data.results || [];
}

export async function fetchSupportedCrops(): Promise<CropInfo[]> {
  const response = await fetch(`${API_BASE_URL}/api/crops`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new ApiError(
      `Nie udało się pobrać słownika upraw (${response.status}).`,
      response.status
    );
  }

  return response.json();
}

export async function analyzeParcelWater(
  payload: AnalyzeRequest
): Promise<AnalysisResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new ApiError(
      `Brak połączenia z serwerem API (${API_BASE_URL}). Nie można uruchomić analizy.`,
      503
    );
  }

  if (!response.ok) {
    const errBody = await response.json().catch(() => null);
    throw new ApiError(
      errBody?.detail ||
        `Nie udało się przeprowadzić analizy (kod ${response.status}).`,
      response.status
    );
  }

  return response.json();
}
