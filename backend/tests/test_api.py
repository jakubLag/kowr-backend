import unittest.mock as mock
import httpx
import pytest
from fastapi.testclient import TestClient
from main import app
from app.services.gis.uldk import _parcel_point_cache

client = TestClient(app)

def test_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "KOWR" in data["project"]

def test_crops_endpoint():
    response = client.get("/api/crops")
    assert response.status_code == 200
    crops = response.json()
    assert len(crops) > 0
    crop_ids = [c["id"] for c in crops]
    assert "kukurydza" in crop_ids
    assert "pszenica_ozima" in crop_ids

def test_parcel_search_endpoint():
    # Test wyszukiwania z formatem TERYT
    response = client.get("/api/parcel/search?teryt=141201_1.0001.123/4")
    assert response.status_code == 200
    data = response.json()
    assert data["teryt"] == "141201_1.0001.123/4"
    assert data["area_ha"] > 0
    assert "geometry" in data
    assert "center" in data
    assert "lat" in data["center"]
    assert "lon" in data["center"]

def test_analyze_endpoint():
    payload = {
        "teryt": "141201_1.0001.123/4",
        "crop": "kukurydza",
        "target_date": "2026-07-15"
    }
    response = client.post("/api/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    
    # Weryfikacja obowiązkowej sekwencji KOWR:
    # 1. Krok 1: Diagnoza
    assert "step1_diagnosis" in data
    diag = data["step1_diagnosis"]
    assert "kbw_30d_mm" in diag
    assert "awc_mm" in diag
    assert "primary_causes" in diag
    assert len(diag["primary_causes"]) > 0

    # 2. Krok 2: Retencja
    assert "step2_retention" in data
    retention = data["step2_retention"]
    assert isinstance(retention, list)
    assert len(retention) > 0
    # Sprawdzamy czy pierwsze zalecenie to priorytet 1 lub 2
    assert retention[0]["priority"] in [1, 2]

    # 3. Krok 3: Nawadnianie
    assert "step3_irrigation" in data
    irr = data["step3_irrigation"]
    assert "needed" in irr
    assert "dose_mm" in irr

    # 4. Metadane
    assert "metadata" in data
    assert len(data["metadata"]["sources"]) == 5


def test_parcel_by_point_success():
    _parcel_point_cache.clear()
    mock_uldk_text = (
        "0\n"
        "141201_1.0001.123/4|mazowieckie|miński|Mińsk Mazowiecki|Nowa Wieś|"
        "SRID=2180;POLYGON((677047.39 481558.91, 677247.39 481558.91, "
        "677247.39 481658.91, 677047.39 481658.91, 677047.39 481558.91))\n"
    )
    mock_response = mock.Mock()
    mock_response.status_code = 200
    mock_response.text = mock_uldk_text

    mock_client_instance = mock.AsyncMock()
    mock_client_instance.get.return_value = mock_response
    mock_client_cm = mock.AsyncMock()
    mock_client_cm.__aenter__.return_value = mock_client_instance

    with mock.patch("app.services.gis.uldk.httpx.AsyncClient", return_value=mock_client_cm):
        response = client.get("/api/parcel/by-point?lat=52.185&lon=21.567")

    assert response.status_code == 200
    data = response.json()
    assert data["teryt"] == "141201_1.0001.123/4"
    assert data["voivodeship"] == "mazowieckie"
    assert data["county"] == "miński"
    assert data["commune"] == "Mińsk Mazowiecki"
    assert data["precinct"] == "Nowa Wieś"
    assert data["parcel_number"] == "123/4"
    assert data["area_ha"] == 2.0
    assert 49.0 <= data["center"]["lat"] <= 55.0
    assert 14.0 <= data["center"]["lon"] <= 24.5
    assert data["geometry"]["type"] == "Polygon"


def test_parcel_by_point_not_found():
    _parcel_point_cache.clear()
    mock_response = mock.Mock()
    mock_response.status_code = 200
    mock_response.text = "-1 brak wyników\n"

    mock_client_instance = mock.AsyncMock()
    mock_client_instance.get.return_value = mock_response
    mock_client_cm = mock.AsyncMock()
    mock_client_cm.__aenter__.return_value = mock_client_instance

    with mock.patch("app.services.gis.uldk.httpx.AsyncClient", return_value=mock_client_cm):
        response = client.get("/api/parcel/by-point?lat=52.100&lon=21.000")

    assert response.status_code == 404
    assert "W klikniętym punkcie nie odnaleziono działki ewidencyjnej" in response.json()["detail"]


def test_parcel_by_point_out_of_bounds_validation():
    response = client.get("/api/parcel/by-point?lat=10.0&lon=10.0")
    assert response.status_code == 422


def test_parcel_by_point_service_error():
    _parcel_point_cache.clear()
    mock_client_instance = mock.AsyncMock()
    mock_client_instance.get.side_effect = httpx.TimeoutException("ULDK timeout")
    mock_client_cm = mock.AsyncMock()
    mock_client_cm.__aenter__.return_value = mock_client_instance

    with mock.patch("app.services.gis.uldk.httpx.AsyncClient", return_value=mock_client_cm):
        response = client.get("/api/parcel/by-point?lat=52.250&lon=21.150")

    assert response.status_code == 502
    assert "Usługa ewidencji gruntów GUGiK (ULDK) jest chwilowo niedostępna" in response.json()["detail"]


