from datetime import date, datetime, timedelta
import logging
from typing import Any, Dict, Optional, Union
import cachetools
import httpx
import pandas as pd

logger = logging.getLogger(__name__)

# TTL Cache: max 500 elementów, czas życia 24h (86400 sekund)
# Chroni serwer VPS (4GB RAM) przed nadmiernym zużyciem pamięci
climatology_cache = cachetools.TTLCache(maxsize=500, ttl=86400)

OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"


def _parse_target_date(target_date: Union[date, str, None]) -> date:
  """Konwertuje datę ze stringa lub obiektu na datetime.date."""
  if not target_date:
    return date.today()
  if isinstance(target_date, str):
    clean_str = target_date.split("T")[0].strip()
    return date.fromisoformat(clean_str)
  if isinstance(target_date, datetime):
    return target_date.date()
  return target_date


def calculate_max_dry_spell_10y(df: pd.DataFrame) -> int:
  """Wyznacza najdłuższy okres bez opadów (< 1 mm) w całej 10-letniej historii."""
  if df.empty:
    return 0
  no_rain = (df["precipitation"] < 1.0).astype(int)
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


async def fetch_10y_climatology(
    lat: float, lon: float, target_date: Union[date, str]
) -> Optional[Dict[str, Any]]:
  """Pobiera dane historyczne z ostatnich 10 lat z Open-Meteo Archive API,

  wyznacza wskaźniki wieloletnie (KOWR) oraz bieżące serie danych
  w żądanym formacie słownika.
  """
  parsed_date = _parse_target_date(target_date)
  rounded_lat = round(lat, 2)
  rounded_lon = round(lon, 2)
  cache_key = (rounded_lat, rounded_lon, parsed_date.year)

  if cache_key in climatology_cache:
    logger.info(
        f"Pobrano dane 10y z cache dla ({rounded_lat}, {rounded_lon}), rok"
        f" {parsed_date.year}"
    )
    return climatology_cache[cache_key]

  # Zakres: 10 lat wstecz od target_date + 60 dni do przodu na poczet prognozy/scenariusza
  start_date = parsed_date - timedelta(days=365 * 10 + 65)
  end_date = parsed_date + timedelta(days=65)

  params = {
      "latitude": rounded_lat,
      "longitude": rounded_lon,
      "start_date": start_date.isoformat(),
      "end_date": end_date.isoformat(),
      "daily": (
          "precipitation_sum,et0_fao_evapotranspiration,temperature_2m_mean,"
          "temperature_2m_max,wind_speed_10m_max"
      ),
      "timezone": "UTC",
  }

  try:
    async with httpx.AsyncClient(timeout=15.0) as client:
      response = await client.get(OPEN_METEO_ARCHIVE_URL, params=params)
      if response.status_code != 200:
        logger.error(
            f"Open-Meteo Archive API error: {response.status_code} -"
            f" {response.text}"
        )
        return None

      data = response.json()
      daily_data = data.get("daily")
      if not daily_data or not daily_data.get("time"):
        return None

      df = pd.DataFrame(
          {
              "date": pd.to_datetime(daily_data["time"]),
              "precipitation": daily_data.get("precipitation_sum", 0),
              "et0": daily_data.get("et0_fao_evapotranspiration", 0),
              "temp_mean": daily_data.get("temperature_2m_mean", 0),
              "temp_max": daily_data.get("temperature_2m_max", 0),
              "wind_max": daily_data.get("wind_speed_10m_max", 0),
          }
      )

      # Czyszczenie i uzupełnienie braków danych
      df["precipitation"] = df["precipitation"].fillna(0)
      df["et0"] = df["et0"].fillna(0)
      df["temp_mean"] = df["temp_mean"].fillna(df["temp_mean"].mean())
      df["temp_max"] = df["temp_max"].fillna(df["temp_max"].mean())
      df["wind_max"] = df["wind_max"].fillna(0)

      # --- ANALIZA 10-LETNIA (KOWR) ---
      df["kbw_daily"] = df["precipitation"] - df["et0"]
      df["year"] = df["date"].dt.year
      df["month"] = df["date"].dt.month

      vegetation_df = df[df["month"].isin([4, 5, 6, 7, 8, 9])]
      years_analyzed = sorted(vegetation_df["year"].unique())
      total_years_analyzed = len(years_analyzed)
      drought_years_count = 0
      soil_kbw_threshold = -150.0  # próg krytyczny IUNG dla gleb lekkich

      for yr in years_analyzed:
        yr_data = vegetation_df[vegetation_df["year"] == yr].sort_values("date")
        rolling_60d = yr_data["kbw_daily"].rolling(window=60).sum()
        min_kbw_60d = rolling_60d.min() if not rolling_60d.empty else 0.0
        if min_kbw_60d < soil_kbw_threshold:
          drought_years_count += 1

      drought_frequency_10y_pct = (
          round((drought_years_count / total_years_analyzed) * 100.0, 1)
          if total_years_analyzed > 0
          else 0.0
      )

      # Miesiące z najwyższym historycznym deficytem (riskiest_months)
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
      riskiest_months = [month_names_pl[m] for m, _ in sorted_months[:3]]

      # Najdłuższy okres bez opadów w historii 10 lat
      max_dry_spell_days = calculate_max_dry_spell_10y(df)

      # --- DANE BIEŻĄCE I PROGNOZA (OKNO 60 dni wstecz + 60 dni do przodu = ~120 wpisów) ---
      target_ts = pd.Timestamp(parsed_date)
      series_mask = (df["date"] >= target_ts - timedelta(days=60)) & (
          df["date"] <= target_ts + timedelta(days=60)
      )
      sub_df = df[series_mask].sort_values("date")

      # Sumy 30d i 60d wstecz od target_date
      past_60d_mask = (df["date"] <= target_ts) & (
          df["date"] >= target_ts - timedelta(days=60)
      )
      past_30d_mask = (df["date"] <= target_ts) & (
          df["date"] >= target_ts - timedelta(days=30)
      )

      precipitation_30d_mm = float(
          df.loc[past_30d_mask, "precipitation"].sum()
      )
      precipitation_60d_mm = float(
          df.loc[past_60d_mask, "precipitation"].sum()
      )
      et0_30d_mm = float(df.loc[past_30d_mask, "et0"].sum())
      et0_60d_mm = float(df.loc[past_60d_mask, "et0"].sum())
      mean_temperature_c = float(df.loc[past_30d_mask, "temp_mean"].mean())

      # Maksymalna prędkość wiatru w ostatnich 30 dniach
      wind_max_ms = float(df.loc[past_30d_mask, "wind_max"].max())

      # Prognoza 7-dniowa
      future_7d_mask = (df["date"] > target_ts) & (
          df["date"] <= target_ts + timedelta(days=7)
      )
      forecast_7d_precip_mm = float(
          df.loc[future_7d_mask, "precipitation"].sum()
      )
      forecast_7d_et0_mm = float(df.loc[future_7d_mask, "et0"].sum())

      # Budowa pełnej 60-do-120-dniowej serii dziennej (`raw_daily_series`)
      raw_daily_series = []
      for _, row in sub_df.iterrows():
        row_date = row["date"].strftime("%Y-%m-%d")
        is_forecast = row["date"] > target_ts
        raw_daily_series.append({
            "date": row_date,
            "precipitation_mm": round(float(row["precipitation"]), 1),
            "et0_mm": round(float(row["et0"]), 1),
            "temp_max_c": round(float(row["temp_max"]), 1),
            "wind_max_ms": round(float(row["wind_max"]), 1),
            "is_forecast": bool(is_forecast),
        })

      result_dict = {
          "precipitation_30d_mm": round(precipitation_30d_mm, 1),
          "precipitation_60d_mm": round(precipitation_60d_mm, 1),
          "et0_30d_mm": round(et0_30d_mm, 1),
          "et0_60d_mm": round(et0_60d_mm, 1),
          "mean_temperature_c": round(mean_temperature_c, 1),
          "forecast_7d_precip_mm": round(forecast_7d_precip_mm, 1),
          "forecast_7d_et0_mm": round(forecast_7d_et0_mm, 1),
          "wind_max_ms": round(wind_max_ms, 1),
          "raw_daily_series": raw_daily_series,
          "drought_frequency_10y_pct": drought_frequency_10y_pct,
          "riskiest_months": riskiest_months,
          "max_dry_spell_days": max_dry_spell_days,
          "is_fallback": False,
      }

      climatology_cache[cache_key] = result_dict
      return result_dict

  except Exception as e:
    logger.error(
        f"Błąd podczas pobierania Open-Meteo Archive dla ({lat}, {lon}): {e}"
    )
    return None