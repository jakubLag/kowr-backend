import pytest
from fastapi.testclient import TestClient
from main import app

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

