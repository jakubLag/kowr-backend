import { ParcelSearchResponse } from "@/types/analysis";

const PARCEL_STORAGE_KEY = "kowr_selected_parcel_v1";

export function saveStoredParcel(parcel: ParcelSearchResponse): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PARCEL_STORAGE_KEY, JSON.stringify(parcel));
  } catch {
    // ignore storage errors
  }
}

export function getStoredParcel(
  teryt?: string | null
): ParcelSearchResponse | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PARCEL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ParcelSearchResponse;
    if (teryt && parsed.teryt !== teryt.trim()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
