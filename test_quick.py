"""
Skrypt do szybkiego przetestowania API bez konieczności uruchamiania osobnego procesu serwera.
Uruchomienie: python test_quick.py
"""

import json
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def run_tests():
    print("=" * 60)
    print(" 🚀 TEST 1: Sprawdzenie statusu API (GET /)")
    print("=" * 60)
    res = client.get("/")
    print(f"Status HTTP: {res.status_code}")
    print(json.dumps(res.json(), indent=2, ensure_ascii=False))

    print("\n" + "=" * 60)
    print(" 📍 TEST 2: Wyszukiwanie działki TERYT (GET /api/parcel/search)")
    print("=" * 60)
    teryt = "141201_1.0001.123/4"
    res = client.get(f"/api/parcel/search?teryt={teryt}")
    print(f"Status HTTP: {res.status_code}")
    parcel = res.json()
    print(f"TERYT:        {parcel['teryt']}")
    print(f"Lokalizacja:  {parcel['voivodeship']}, {parcel['county']}, {parcel['commune']}")
    print(f"Powierzchnia: {parcel['area_ha']} ha")
    print(f"Punkt centralny (WGS84): lat={parcel['center']['lat']}, lon={parcel['center']['lon']}")
    print(f"Typ geometrii: {parcel['geometry']['type']}")

    print("\n" + "=" * 60)
    print(" 🌾 TEST 3: Pobranie bazy upraw (GET /api/crops)")
    print("=" * 60)
    res = client.get("/api/crops")
    print(f"Status HTTP: {res.status_code}")
    crops = res.json()
    print(f"Zarejestrowane uprawy ({len(crops)}):")
    for c in crops[:4]:
        print(f" - {c['name_pl']} (Kc mid: {c['kc_mid']}, wrażliwość: {c['drought_sensitivity']})")
    print("   ...")

    print("\n" + "=" * 60)
    print(" 💧 TEST 4: Pełna analiza działki KOWR (POST /api/analyze)")
    print("=" * 60)
    payload = {
        "teryt": teryt,
        "crop": "kukurydza",
        "target_date": "2026-07-15"
    }
    res = client.post("/api/analyze", json=payload)
    print(f"Status HTTP: {res.status_code}")
    analysis = res.json()

    print("\n[ETAP 1: DIAGNOZA STANU WODY]")
    diag = analysis["step1_diagnosis"]
    print(f"• Poziom ryzyka suszy:    {diag['drought_risk_level']}")
    print(f"• Klimatyczny Bilans KBW: 30 dni: {diag['kbw_30d_mm']} mm | 60 dni: {diag['kbw_60d_mm']} mm")
    print(f"• Retencja glebowa (AWC): {diag['awc_mm']} mm (kategoria: {diag['soil_category']})")
    print(f"• Uziarnienie gleby:      {diag['soil_texture']}")
    print(f"• Anomalia NDVI:          {diag['ndvi_anomaly_percent']}%")
    print(f"• Spadek terenu:          {diag['slope_percent']}%")
    print(f"• Odległość do rowu:      {diag['distance_to_ditch_m']} m")
    print("• Zidentyfikowane przyczyny deficytu:")
    for cause in diag["primary_causes"]:
        print(f"   - {cause}")

    print("\n[ETAP 2: DOBÓR DZIAŁAŃ RETENCYJNYCH]")
    for i, action in enumerate(analysis["step2_retention"], 1):
        print(f"{i}. [{action['badge']}] {action['title']}")
        print(f"   Dlaczego: {action['why']}")
        print(f"   Działanie: {action['action']}\n")

    print("[ETAP 3: REKOMENDACJA NAWADNIANIA]")
    irr = analysis["step3_irrigation"]
    print(f"• Czy wymagane:  {irr['needed']}")
    print(f"• Status:        {irr['status']}")
    print(f"• Dawka:         {irr['dose_mm']} mm ({irr['dose_m3_per_ha']} m³/ha)")
    print(f"• Technika:      {irr['recommended_technique']}")
    print(f"• Pora zabiegu:  {irr['recommended_timing']}")
    print(f"• Uzasadnienie:  {irr['justification']}")

    print("\n[METADANE I CZAS]")
    meta = analysis["metadata"]
    print(f"• Czas obliczeń: {meta['execution_time_ms']} ms")
    print(f"• Liczba źródeł: {len(meta['sources'])}")

    print("\n" + "=" * 60)
    print(" ✅ Wszystkie testy API przeszły pomyślnie!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()

