# KOWR – „Zatrzymaj wodę, chroń plony” (Backend)

Backend REST API stworzony na hackathon **HackNation 2026** w ramach zadania **Krajowego Ośrodka Wsparcia Rolnictwa (KOWR)**.

Aplikacja wspiera rolników w analizie ryzyka suszy i doborze rekomendacji retencyjnych dla konkretnej działki ewidencyjnej po identyfikatorze **TERYT** w czasie **< 3 sekund**.

---

## 🎯 Kluczowe Założenie: ZERO LLM (100% Determinizm)
W silniku decyzyjnym **nie stosujemy modeli LLM** (brak halucynacji, 100% audytowalność, powtarzalność i brak opóźnień sieciowych). Zamiast tego zaimplementowano moduł `app/services/science/report_generator.py` oparty na:
- Metodyce **FAO-56** (ewapotranspiracja Penmana-Monteitha, współczynniki roślinne $K_c$),
- Kryteriach **IUNG-PIB** (klimatyczny bilans wodny KBW),
- Równaniach pedotransferowych **Saxtona & Rawlsa (2006)** (polowa pojemność wodna AWC),
- Deterministycznym silniku reguł agrohydrologicznych.

---

## 🛰️ 5 Zintegrowanych Źródeł Danych
1. **Granice działki:** ULDK GUGiK (reprezentatywny punkt działki, przeliczenie PUWG 1992 `EPSG:2180` $\to$ `EPSG:4326`, powierzchnia w ha).
2. **Pogoda (10 lat + prognoza):** Open-Meteo API (opady $P$, $ET_0$, temperatura, bilanse 30- i 60-dniowe).
3. **Satelita:** AWS STAC Earth Search (Sentinel-2 L2A COG: pasma B04, B08, B11, SCL z oknem 21 dni, NDVI i NDMI; fallback przy zachmurzeniu > 15%).
4. **Gleba:** ISRIC SoilGrids REST API (frakcje piasku, pyłu, iłu oraz SOC dla warstwy 0–30 cm).
5. **Rzeźba terenu i cieki:** Geoportal NMT WCS (nachylenie stoku) + Overpass API / BDOT10k (wykrywanie cieków i rowów w promieniu 500 m).

---

## 📋 Obowiązkowa Sekwencja Raportu (Wymóg KOWR)
1. **Etap 1: Diagnoza stanu wody i przyczyny deficytu** (KBW 30d/60d, ryzyko suszy, retencja glebowa AWC, anomalia NDVI).
2. **Etap 2: Dobór działań retencyjnych i agrotechnicznych** (Zasada: *"Retain water where it falls"* – bezwzględny priorytet retencji krajobrazowej i glebowej: zastawki na rowach, międzyplony, mulczowanie, uprawa bezorkowa).
3. **Etap 3: Opcjonalne rekomendacje nawadniania** (wyłącznie interwencyjnie: dawka w mm lub $m^3/ha$, właściwa technika i pora).
4. **Metadane i transparentność:** Jawny wykaz źródeł, daty zobrazowań oraz lista ograniczeń analizy (`limitations`).

---

## 🚀 Uruchomienie lokalne

### 1. Wymagania
- Python 3.11+ lub `uv`

### 2. Instalacja zależności
```bash
# Za pomocą uv (zalecane - błyskawiczne):
uv venv
source .venv/bin/activate
uv pip install -r requirements.txt

# Lub standardowo przez pip:
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Start serwera developerskiego
```bash
uvicorn main:app --reload --port 8000
```
Serwer uruchomi się pod adresem: `http://localhost:8000`
- Dokumentacja Swagger: `http://localhost:8000/docs`
- Dokumentacja ReDoc: `http://localhost:8000/redoc`

---

## 🔌 Kontrakty API

### 1. `GET /api/parcel/search?teryt={teryt}`
Pobiera geometrię, powierzchnię w ha i punkt centralny dla podanego TERYT.
**Przykład:** `GET /api/parcel/search?teryt=141201_1.0001.123/4`

### 2. `POST /api/analyze`
Główna analiza działki.
**Body:**
```json
{
  "teryt": "141201_1.0001.123/4",
  "crop": "kukurydza",
  "target_date": "2026-07-15"
}
```

### 3. `GET /api/crops`
Lista obsługiwanych upraw i ich współczynników $K_c$.

### 4. `GET /api/health`
Monitoring dostępności zewnętrznych usług (ULDK, Open-Meteo, AWS STAC, SoilGrids).

---

## 🧪 Testy jednostkowe
```bash
pytest
```

