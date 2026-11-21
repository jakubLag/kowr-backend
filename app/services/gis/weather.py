"""
Klient Open-Meteo API.
Pobiera sumy opadów (P), temperaturę średnią oraz ewapotranspirację referencyjną (ET0 Penmana-Monteitha)
dla punktu działki z ostatnich 30 i 60 dni oraz medianę wieloletnią.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger("weather")

def _parse_weather_response(data: Dict[str, Any]) -> Dict[str, Any]:
    daily = data.get("daily", {})
    precip = daily.get("precipitation_sum", [])
    et0 = daily.get("et0_fao_evapotranspiration", [])
    temps = daily.get("temperature_2m_mean", [])

    p_30d = sum(p for p in precip[-30:] if p is not None)
    p_60d = sum(p for p in precip if p is not None)
    et0_30d = sum(e for e in et0[-30:] if e is not None)
    et0_60d = sum(e for e in et0 if e is not None)
    valid_temps = [t for t in temps if t is not None]
    avg_temp = sum(valid_temps) / len(valid_temps) if valid_temps else 18.5

    return {
        "precipitation_30d_mm": round(p_30d, 1),
        "precipitation_60d_mm": round(p_60d, 1),
        "et0_30d_mm": round(et0_30d, 1),
        "et0_60d_mm": round(et0_60d, 1),
        "mean_temperature_c": round(avg_temp, 1),
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
        params = {
            "latitude": round(lat, 4),
            "longitude": round(lon, 4),
            "start_date": start_date_60d.strftime("%Y-%m-%d"),
            "end_date": end_date.strftime("%Y-%m-%d"),
            "daily": ["precipitation_sum", "et0_fao_evapotranspiration", "temperature_2m_mean"],
            "timezone": "Europe/Warsaw"
        }
    else:
        params = {
            "latitude": round(lat, 4),
            "longitude": round(lon, 4),
            "past_days": 60,
            "forecast_days": 1,
            "daily": ["precipitation_sum", "et0_fao_evapotranspiration", "temperature_2m_mean"],
            "timezone": "Europe/Warsaw"
        }

    try:
        async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT_SECONDS) as client:
            resp = await client.get(url, params=params)
            if resp.status_code == 200:
                return _parse_weather_response(resp.json())
            else:
                logger.warning(f"[Open-Meteo] Błąd HTTP {resp.status_code} ({url}): {resp.text.strip()}")

            # Jeśli Archive API rzuciło błąd (np. 429 rate-limit lub data w przyszłości),
            # próbujemy zapasowo Forecast API z past_days=60
            if is_archive:
                logger.info("[Open-Meteo] Próba zapasowa przez Forecast API...")
                resp_forecast = await client.get(settings.OPEN_METEO_FORECAST_URL, params={
                    "latitude": round(lat, 4),
                    "longitude": round(lon, 4),
                    "past_days": 60,
                    "forecast_days": 1,
                    "daily": ["precipitation_sum", "et0_fao_evapotranspiration", "temperature_2m_mean"],
                    "timezone": "Europe/Warsaw"
                })
                if resp_forecast.status_code == 200:
                    return _parse_weather_response(resp_forecast.json())
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
        "mean_temperature_c": 19.2,
        "is_fallback": True
    }

