import { ParcelSearchResponse } from "@/types/analysis";

const PARCEL_STORAGE_KEY = "kowr_selected_parcel_v1";
const RECENT_PARCELS_KEY = "kowr_recent_parcels_v1";
const MAX_RECENT_PARCELS = 6;

export function saveStoredParcel(parcel: ParcelSearchResponse): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PARCEL_STORAGE_KEY, JSON.stringify(parcel));
    addRecentParcel(parcel);
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

export function getRecentParcels(): ParcelSearchResponse[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_PARCELS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addRecentParcel(parcel: ParcelSearchResponse): void {
  if (typeof window === "undefined" || !parcel?.teryt) return;
  try {
    const existing = getRecentParcels().filter(
      (item) => item.teryt !== parcel.teryt
    );
    const updated = [parcel, ...existing].slice(0, MAX_RECENT_PARCELS);
    localStorage.setItem(RECENT_PARCELS_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export function removeRecentParcel(teryt: string): void {
  if (typeof window === "undefined") return;
  try {
    const updated = getRecentParcels().filter((item) => item.teryt !== teryt);
    localStorage.setItem(RECENT_PARCELS_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}
