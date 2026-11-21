import asyncio
from datetime import date
from app.services.gis.weather import (
    fetch_10y_climatology,
    analyze_climatology_metrics,
)


def test_fetch_and_analyze_climatology():
  # Uruchomienie kodu asynchronicznego w synchronicznym teście pytest
  lat, lon = 52.23, 21.01
  target_date = "2024-07-30"

  # 1. Pobieranie danych z Open-Meteo Archive API
  df = asyncio.run(fetch_10y_climatology(lat, lon, target_date))
  assert df is not None, "API powinno zwrócić dane dla poprawnych współrzędnych"
  assert not df.empty, "DataFrame nie powinien być pusty"
  assert "precipitation" in df.columns
  assert "et0" in df.columns

  # 2. Sprawdzenie logiki analitycznej
  metrics = analyze_climatology_metrics(df, target_date)
  assert "historical_vulnerability_level" in metrics
  assert metrics["historical_vulnerability_level"] in [
      "NISKA",
      "UMIARKOWANA",
      "WYSOKA",
  ]
  assert isinstance(metrics["peak_risk_months"], list)
  assert len(metrics["peak_risk_months"]) <= 3