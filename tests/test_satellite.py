import pytest
from app.services.gis.satellite import fetch_sentinel_indices, _SATELLITE_CACHE

@pytest.mark.anyio
async def test_fetch_sentinel_indices_schema():
    # Testuje zwracany schemat danych satelitarnych
    data = await fetch_sentinel_indices(lat=52.2, lon=21.0, target_date_str="2024-06-25")
    
    assert "ndvi_historical_median" in data
    assert "scene_date" in data
    assert "cloud_cover_percent" in data
    assert "limitation_note" in data
    assert "ndmi_current" in data
    
    # Sprawdzenie typu i zakresu wskaźników
    if data["ndvi_current"] is not None:
        assert -1.0 <= data["ndvi_current"] <= 1.0
    if data["ndmi_current"] is not None:
        assert -1.0 <= data["ndmi_current"] <= 1.0

@pytest.mark.anyio
async def test_satellite_cache():
    # Weryfikacja działania pamięci podręcznej (cache)
    cache_key = (round(52.2, 4), round(21.0, 4), "2024-06-25")
    assert cache_key in _SATELLITE_CACHE
    
    cached_data = await fetch_sentinel_indices(lat=52.2, lon=21.0, target_date_str="2024-06-25")
    assert cached_data == _SATELLITE_CACHE[cache_key]

