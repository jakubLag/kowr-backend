"""
Klient Open-Meteo API.
Pobiera sumy opadów (P), temperaturę średnią, prędkość wiatru oraz ewapotranspirację referencyjną (ET0 Penmana-Monteitha)
dla punktu działki z ostatnich 30 i 60 dni oraz 7-dniową prognozę.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import httpx
from app.core.config import settings

logger = logging.getLogger("weather")


def _parse_weather_response(data: Dict[str, Any], has_forecast_7d: bool = False) -> Dict[str, Any]:
    daily = data.get("daily", {})
    dates = daily.get("time", [])
    precip = daily.get("precipitation_sum", [])
    et0 = daily.get("et0_fao_evapotranspiration", [])
    temps = daily.get("temperature_2m_mean", [])
    winds = daily.get("wind_speed_10m_max", [])

    # Oddzielenie historii (do target_date / dzisiaj) od 7 dni prognozy
    hist_len = max(1, len(precip) - 7) if has_forecast_7d and len(precip) > 30 else len(precip)
    hist_precip = precip[:hist_len]
    hist_et0 = et0[:hist_len]
    fc_precip = precip[hist_len:] if has_forecast_7d else []
    fc_et0 = et0[hist_len:] if has_forecast_7d else []

    p_30d = sum(p for p in hist_precip[-30:] if p is not None)
    p_60d = sum(p for p in hist_precip if p is not None)
    et0_30d = sum(e for e in hist_et0[-30:] if e is not None)
    et0_60d = sum(e for e in hist_et0 if e is not None)
    fc_p_7d = sum(p for p in fc_precip if p is not None)
    fc_et0_7d = sum(e for e in fc_et0 if e is not None)

    valid_temps = [t for t in temps[:hist_len] if t is not None]
    avg_temp = sum(valid_temps) / len(valid_temps) if valid_temps else 18.5

    # Budowa dziennej serii: ostatnie 30 dni historii + (opcjonalnie) 7 dni prognozy
    start_idx = max(0, hist_len - 30)
    raw_daily_series: List[Dict[str, Any]] = []
    for idx in range(start_idx, len(precip)):
        raw_daily_series.append({
            "date": dates[idx] if idx < len(dates) else "",
            "precipitation_mm": round(float(precip[idx] or 0.0), 1),
            "et0_mm": round(float(et0[idx] or 0.0), 1),
            "temp_max_c": round(float(temps[idx]), 1) if idx < len(temps) and temps[idx] is not None else None,
            "wind_max_ms": round(float(winds[idx]), 1) if idx < len(winds) and winds[idx] is not None else None,
            "is_forecast": idx >= hist_len,
        })

    return {
        "precipitation_30d_mm": round(p_30d, 1),
        "precipitation_60d_mm": round(p_60d, 1),
        "et0_30d_mm": round(et0_30d, 1),
        "et0_60d_mm": round(et0_60d, 1),
        "forecast_7d_precip_mm": round(fc_p_7d, 1),
        "forecast_7d_et0_mm": round(fc_et0_7d, 1),
        "mean_temperature_c": round(avg_temp, 1),
        "raw_daily_series": raw_daily_series,
        "is_fallback": False
    }


async def fetch_weather_data(lat: float, lon: float, target_date_str: Optional[str] = None) -> Dict[str, Any]:
    """
    Pobiera dane pogodowe z Open-Meteo API.
    Jeśli API zwróci błąd (np. rate-limit 429), rejestruje błąd w logach i stosuje fallback.
    """
    if target_date_str:
        try:
            target_date = datetime.strptime(target_date_str, "%Y-%m-%d").date()
        except ValueError:
            target_date = datetime.now().date()
    else:
        target_date = datetime.now().date()

    start_date_60d = target_date - timedelta(days=60)
    end_date = target_date

    # Wybór URL: archiwum czy bieżąca prognoza
    is_archive = (datetime.now().date() - target_date).days > 7
    url = settings.OPEN_METEO_BASE_URL if is_archive else settings.OPEN_METEO_FORECAST_URL

    if is_archive:
        # W archiwum możemy pobrać również 7 kolejnych dni po target_date jako okno 7-dniowe
        max_archive_date = datetime.now().date() - timedelta(days=2)
        archive_end_with_7d = min(max_archive_date, end_date + timedelta(days=7))
        has_7d = (archive_end_with_7d - end_date).days >= 7
        params = {
            "latitude": round(lat, 4),
            "longitude": round(lon, 4),
            "start_date": start_date_60d.strftime("%Y-%m-%d"),
            "end_date": (archive_end_with_7d if has_7d else end_date).strftime("%Y-%m-%d"),
            "daily": ["precipitation_sum", "et0_fao_evapotranspiration", "temperature_2m_mean", "wind_speed_10m_max"],
            "wind_speed_unit": "ms",
            "timezone": "Europe/Warsaw"
        }
    else:
        has_7d = True
        params = {
            "latitude": round(lat, 4),
            "longitude": round(lon, 4),
            "past_days": 60,
            "forecast_days": 7,
            "daily": ["precipitation_sum", "et0_fao_evapotranspiration", "temperature_2m_mean", "wind_speed_10m_max"],
            "wind_speed_unit": "ms",
            "timezone": "Europe/Warsaw"
        }

    try:
        async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT_SECONDS) as client:
            resp = await client.get(url, params=params)
            if resp.status_code == 200:
                return _parse_weather_response(resp.json(), has_forecast_7d=has_7d)
            else:
                logger.warning(f"[Open-Meteo] Błąd HTTP {resp.status_code} ({url}): {resp.text.strip()}")

            # Jeśli Archive API rzuciło błąd (np. 429 rate-limit lub data w przyszłości),
            # próbujemy zapasowo Forecast API z past_days=60 i forecast_days=7
            if is_archive:
                logger.info("[Open-Meteo] Próba zapasowa przez Forecast API...")
                resp_forecast = await client.get(settings.OPEN_METEO_FORECAST_URL, params={
                    "latitude": round(lat, 4),
                    "longitude": round(lon, 4),
                    "past_days": 60,
                    "forecast_days": 7,
                    "daily": ["precipitation_sum", "et0_fao_evapotranspiration", "temperature_2m_mean", "wind_speed_10m_max"],
                    "wind_speed_unit": "ms",
                    "timezone": "Europe/Warsaw"
                })
                if resp_forecast.status_code == 200:
                    return _parse_weather_response(resp_forecast.json(), has_forecast_7d=True)
                else:
                    logger.warning(f"[Open-Meteo Forecast] Błąd HTTP {resp_forecast.status_code}: {resp_forecast.text.strip()}")

    except Exception as e:
        logger.warning(f"[Open-Meteo] Błąd połączenia / timeout: {e}")

    # Deterministyczny fallback meteorologiczny dla Polski (symulacja warunków letnich z lekkim deficytem)
    return {
        "precipitation_30d_mm": 38.0,
        "precipitation_60d_mm": 72.0,
        "et0_30d_mm": 115.0,
        "et0_60d_mm": 220.0,
        "forecast_7d_precip_mm": 9.5,
        "forecast_7d_et0_mm": 25.2,
        "mean_temperature_c": 19.2,
        "raw_daily_series": [],
        "is_fallback": True
    }
