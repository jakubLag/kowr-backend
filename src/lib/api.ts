import {
  AnalyzeRequest,
  AnalysisResponse,
  ParcelSearchResponse,
} from "@/types/analysis";
import { getMockAnalysis, getMockParcelByTeryt } from "@/lib/mockData";

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

export interface ApiResultWithSource<T> {
  data: T;
  source: "api" | "mock";
}

export async function searchParcelByTeryt(
  teryt: string,
  forceMock: boolean = false
): Promise<ApiResultWithSource<ParcelSearchResponse>> {
  const cleanTeryt = teryt.trim();

  if (!forceMock) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/parcel/search?teryt=${encodeURIComponent(cleanTeryt)}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        }
      );

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

      const data: ParcelSearchResponse = await response.json();
      return { data, source: "api" };
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
      // Network error (e.g., FastAPI backend not started yet) -> fallback to mock
      console.info(
        "[KOWR API] Backend FastAPI niedostępny pod",
        API_BASE_URL,
        "— używam lokalnych danych demonstracyjnych (Mock)."
      );
    }
  }

  // Simulate slight network latency for realistic UX in mock mode
  await new Promise((r) => setTimeout(r, 450));
  const mockParcel = getMockParcelByTeryt(cleanTeryt);
  if (!mockParcel) {
    throw new ApiError(
      `Nie znaleziono działki o numerze "${cleanTeryt}". Upewnij się, że wpisujesz kod w formacie WWPPGG_R.OOOO.NR_DZIAŁKI (np. 141201_1.0001.123/4).`,
      404
    );
  }

  return { data: mockParcel, source: "mock" };
}

export async function analyzeParcelWater(
  payload: AnalyzeRequest,
  parcel?: ParcelSearchResponse | null,
  forceMock: boolean = false,
  mockDelayMs: number = 11500
): Promise<ApiResultWithSource<AnalysisResponse>> {
  if (!forceMock) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        throw new ApiError(
          errBody?.detail ||
            `Nie udało się przeprowadzić analizy (kod ${response.status}).`,
          response.status
        );
      }

      const data: AnalysisResponse = await response.json();
      return { data, source: "api" };
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
      console.info(
        "[KOWR API] Backend FastAPI niedostępny podczas analizy — używam lokalnego mocka."
      );
    }
  }

  await new Promise((r) => setTimeout(r, mockDelayMs));
  const mockResult = getMockAnalysis(payload, parcel);
  return { data: mockResult, source: "mock" };
}
