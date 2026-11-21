import asyncio
from datetime import date, datetime, timedelta
import logging
from typing import Any, Dict, Optional, Union
import cachetools
import httpx
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# TTL Cache: max 500 elementów, czas życia 24h (86400 sekund)
climatology_cache = cachetools.TTLCache(maxsize=500, ttl=86400)

OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"


def _parse_target_date(target_date: Union[date, str]) -> date:
  """Konwertuje datę ze stringa (np. '2026-07-15' lub pełny ISO) na obiekt datetime.date."""
  if isinstance(target_date, str):
    # Ucinamy ewentualną część czasową (np. '2026-07-15T12:00:00Z' -> '2026-07-15')
    clean_date_str = target_date.split("T")[0].strip()
    return date.fromisoformat(clean_date_str)
  if isinstance(target_date, datetime):
    return target_date.date()
  return target_date


async def fetch_10y_climatology(
    lat: float, lon: float, target_date: Union[date, str]
) -> Optional[pd.DataFrame]:
  """Pobiera dane historyczne z ostatnich 10 lat z Open-Meteo Archive API

  dla pól: precipitation_sum, et0_fao_evapotranspiration, temperature_2m_mean.
  """
  try:
    parsed_date = _parse_target_date(target_date)
  except ValueError as e:
    logger.error(f"Nieprawidłowy format daty target_date '{target_date}': {e}")
    return None

  rounded_lat = round(lat, 2)
  rounded_lon = round(lon, 2)
  cache_key = (rounded_lat, rounded_lon, parsed_date.year)

  if cache_key in climatology_cache:
    logger.info(
        f"Pobrano dane 10y z cache dla ({rounded_lat}, {rounded_lon}), rok"
        f" {parsed_date.year}"
    )
    return climatology_cache[cache_key]

  start_date = parsed_date - timedelta(days=365 * 10 + 2)
  params = {
      "latitude": rounded_lat,
      "longitude": rounded_lon,
      "start_date": start_date.isoformat(),
      "end_date": parsed_date.isoformat(),
      "daily": (
          "precipitation_sum,et0_fao_evapotranspiration,temperature_2m_mean"
      ),
      "timezone": "UTC",
  }

  try:
    async with httpx.AsyncClient(timeout=15.0) as client:
      response = await client.get(OPEN_METEO_ARCHIVE_URL, params=params)
      if response.status_code != 200:
        logger.error(
            f"Open-Meteo API error: {response.status_code} - {response.text}"
        )
        return None

      data = response.json()
      daily_data = data.get("daily")
      if not daily_data:
        return None

      df = pd.DataFrame(
          {
              "date": pd.to_datetime(daily_data["time"]),
              "precipitation": daily_data.get("precipitation_sum", 0),
              "et0": daily_data.get("et0_fao_evapotranspiration", 0),
              "temp_mean": daily_data.get("temperature_2m_mean", 0),
          }
      )

      df["precipitation"] = df["precipitation"].fillna(0)
      df["et0"] = df["et0"].fillna(0)
      df["temp_mean"] = df["temp_mean"].fillna(df["temp_mean"].mean())

      climatology_cache[cache_key] = df
      return df

  except Exception as e:
    logger.error(
        f"Błąd podczas odpytywania Open-Meteo Archive API dla ({lat}, {lon}):"
        f" {e}"
    )
    return None


def calculate_dry_spells(df: pd.DataFrame, window_days: int = 30) -> int:
  """Wyznacza najdłuższy ciąg dni bezopadowych (< 1 mm) w ostatnich N dniach."""
  if df.empty:
    return 0
  recent_df = df.tail(window_days)
  no_rain = (recent_df["precipitation"] < 1.0).astype(int)
  max_spell = 0
  current_spell = 0
  for val in no_rain:
    if val == 1:
      current_spell += 1
      if current_spell > max_spell:
        max_spell = current_spell
    else:
      current_spell = 0
  return int(max_spell)


def calculate_10y_max_dry_spells(df: pd.DataFrame) -> float:
  """Oblicza średni najdłuższy okres bezopadowy z 10 lat (rok po roku)."""
  if df.empty:
    return 0.0
  df["year"] = df["date"].dt.year
  max_spells = []
  for _, group in df.groupby("year"):
    no_rain = (group["precipitation"] < 1.0).astype(int)
    max_spell = 0
    current_spell = 0
    for val in no_rain:
      if val == 1:
        current_spell += 1
        if current_spell > max_spell:
          max_spell = current_spell
      else:
        current_spell = 0
    max_spells.append(max_spell)

  return float(np.mean(max_spells)) if max_spells else 0.0


def analyze_climatology_metrics(
    df: Optional[pd.DataFrame],
    target_date: Union[date, str],
    soil_kbw_threshold: float = -150.0,
) -> Dict[str, Any]:
  """Przeprowadza kompleksową analizę hydrologiczno-klimatyczną na podstawie 10 lat danych."""
  if df is None or df.empty:
    return {
        "drought_years_count": 0,
        "total_years_analyzed": 0,
        "historical_vulnerability_level": "BRAK DANYCH",
        "peak_risk_months": [],
        "max_dry_spell_days_30d": 0,
        "avg_max_dry_spell_10y": 0.0,
        "kbw_60d_10y_median_mm": 0.0,
        "error": "Brak danych historycznych",
    }

  parsed_date = _parse_target_date(target_date)

  df["kbw_daily"] = df["precipitation"] - df["et0"]
  df["year"] = df["date"].dt.year
  df["month"] = df["date"].dt.month

  # 1. Sezon wegetacyjny IV-IX (miesiące 4 do 9) - 60-dniowe okna KBW
  vegetation_df = df[df["month"].isin([4, 5, 6, 7, 8, 9])]

  years_analyzed = sorted(vegetation_df["year"].unique())
  total_years_analyzed = len(years_analyzed)
  drought_years_count = 0

  yearly_60d_kbw = []
  for yr in years_analyzed:
    yr_data = vegetation_df[vegetation_df["year"] == yr].sort_values("date")
    rolling_60d = yr_data["kbw_daily"].rolling(window=60).sum()
    min_kbw_60d = rolling_60d.min() if not rolling_60d.empty else 0.0
    yearly_60d_kbw.append(min_kbw_60d)

    if min_kbw_60d < soil_kbw_threshold:
      drought_years_count += 1

  if total_years_analyzed > 0:
    drought_ratio = drought_years_count / total_years_analyzed
    if drought_ratio >= 0.5:
      historical_vulnerability_level = "WYSOKA"
    elif drought_ratio >= 0.2:
      historical_vulnerability_level = "UMIARKOWANA"
    else:
      historical_vulnerability_level = "NISKA"
  else:
    historical_vulnerability_level = "NISKA"

  # 2. Peak risk months
  monthly_avg_kbw = df.groupby("month")["kbw_daily"].sum().to_dict()
  sorted_months = sorted(monthly_avg_kbw.items(), key=lambda x: x[1])
  month_names_pl = {
      1: "styczeń",
      2: "luty",
      3: "marzec",
      4: "kwiecień",
      5: "maj",
      6: "czerwiec",
      7: "lipiec",
      8: "sierpień",
      9: "wrzesień",
      10: "październik",
      11: "listopad",
      12: "grudzień",
  }
  peak_risk_months = [month_names_pl[m] for m, _ in sorted_months[:3]]

  # 3. Ciągi bezopadowe
  max_dry_spell_days_30d = calculate_dry_spells(df, window_days=30)
  avg_max_dry_spell_10y = calculate_10y_max_dry_spells(df)

  # 4. Mediana 10-letnia KBW dla okna 60-dniowego
  kbw_60d_10y_median_mm = (
      float(np.median(yearly_60d_kbw)) if yearly_60d_kbw else 0.0
  )

  return {
      "drought_years_count": int(drought_years_count),
      "total_years_analyzed": int(total_years_analyzed),
      "historical_vulnerability_level": historical_vulnerability_level,
      "peak_risk_months": peak_risk_months,
      "max_dry_spell_days_30d": int(max_dry_spell_days_30d),
      "avg_max_dry_spell_10y": round(avg_max_dry_spell_10y, 1),
      "kbw_60d_10y_median_mm": round(kbw_60d_10y_median_mm, 1),
  }