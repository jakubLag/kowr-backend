---
description: Kontekst techniczny i reguły projektu KOWR "Zatrzymaj wodę, chroń plony" (HackNation 2026)
globs: **/*
---

# Projekt: KOWR – „Zatrzymaj wodę, chroń plony” (HackNation 2026)

## 1. Cel i Kontekst Konkursowy
- **Konkurs:** HackNation 2026 (Zadanie KOWR: *„Zatrzymaj wodę, chroń plony – Inteligentne wsparcie gospodarowania wodą w rolnictwie”*).
- **Cel:** Działający prototyp aplikacji webowej (uruchamianej w przeglądarce bez instalowania dodatkowego oprogramowania), wspierającej rolników w analizie ryzyka suszy i doborze działań retencyjnych na konkretnej działce.
- **Kluczowy wymóg wydajnościowy:** Wygenerowanie pełnego raportu dla działki w czasie **poniżej 30 sekund**.
- **Wymóg prawny:** Kod musi opierać się wyłącznie na licencjach komercyjnych (przeniesienie praw autorskich na KOWR).

---

## 2. Kluczowe Założenie Architektoniczne: ZERO LLM (100% Determinizm)
- **Świadoma rezygnacja z LLM:** W projekcie **NIE UŻYWAMY** modeli językowych (OpenAI, Anthropic, Gemini ani lokalnych LLM) w silniku decyzyjnym ani do generowania raportu.
- **Powody:**
  1. *Wiarygodność merytoryczna:* Eliminacja ryzyka halucynacji i błędów w zaleceniach agrotechnicznych.
  2. *Audytowalność i determinizm:* Te same dane wejściowe dają zawsze ten sam, uzasadniony wynik zgodny z metodyką IUNG-PIB i FAO-56.
  3. *Wydajność:* Skrócenie czasu generowania raportu do **3–6 sekund** (eliminacja 10-20 sekundowych opóźnień API LLM).
  4. *Niezawodność:* Zero ryzyka awarii na demo live (brak limitów tokenów, rate limitów i kosztów API).
- **Zastępstwo dla LLM:** Zamiast `llm/translator.py` stosujemy moduł `science/report_generator.py` oparty na szablonach eksperckich (Jinja2 / predefiniowane słowniki zaleceń). Wyniki prezentujemy w czytelnych kartach/kafelkach UI.

---

## 3. Stack Technologiczny
- **Backend:**
  - Python 3.11+, FastAPI (asynchroniczny serwer REST API).
  - Pydantic v2 (walidacja schematów wejścia/wyjścia).
  - `httpx` + `asyncio.gather` z limitem czasu (timeout 7s na usługę zewnętrzną).
  - Przetwarzanie geoprzestrzenne: `shapely`, `pyproj` (konwersje CRS), `rasterio` + `pystac-client` (odczyt Cloud-Optimized GeoTIFF - COG przez HTTP Range Requests).
- **Frontend:**
  - Next.js 14+ (App Router), TypeScript, Tailwind CSS.
  - Mapy: Leaflet / MapLibre (dynamiczny import `next/dynamic` z `{ ssr: false }`).
  - Eksport raportu do PDF: Czysty wydruk przez przeglądarkę (`@media print` w Tailwind + `window.print()`), bez ciężkich bibliotek PDF po stronie serwera.

---

## 4. 5 Wymaganych Źródeł Danych i Obsługa Przestrzenna
Każde zapytanie przetwarza dane z 5 niezależnych kategorii:
1. **Granice działki:** ULDK GUGiK (`uldk.gugik.gov.pl`). Transformacja geometrii z układu polskiego `EPSG:2180` do `EPSG:4326` (WGS84). Użycie `shapely.representative_point()` zamiast centroidu (obsługa działek nieregularnych / litery L).
2. **Pogoda (10 lat + prognoza):** Open-Meteo API. Pobranie sum opadów ($P$), temperatury oraz ewapotranspiracji referencyjnej ($ET_0$ Penmana-Monteitha) jednym zapytaniem HTTP.
3. **Satelita (kondycja roślin):** AWS Earth Search STAC (Sentinel-2 L2A COG). Pasma B04 (Red), B08 (NIR), B11 (SWIR) oraz maska chmur SCL w oknie ostatnich 21 dni. Odczyt wyłącznie pikseli działki.
   - *Fallback:* Przy trwałym zachmurzeniu (>15% w całym oknie) nie wyrzucamy błędu – raport oznacza NDVI jako niedostępne z adnotacją w `limitations`.
4. **Gleba:** ISRIC SoilGrids REST API. Frakcje piasku, pyłu, iłu oraz węgiel organiczny (SOC) dla warstwy 0–30 cm.
5. **Rzeźba terenu i hydrologia:** Geoportal NMT WCS (obliczenie średniego nachylenia stoku) + Overpass API / BDOT10k WFS (wykrywanie cieków i rowów melioracyjnych w buforze 500 m).

---

## 5. Algorytmy i Metodyka Agrohydrologiczna
- **Klimatyczny Bilans Wodny (KBW):**
  $$KBW = P - (ET_0 \times K_c)$$
  Wyliczany dla okresów 30- i 60-dniowych. Współczynniki roślinne $K_c$ pobierane ze słownika upraw (metodyka FAO-56).
- **Wskaźniki Teledetekcyjne:**
  - $NDVI = (B08 - B04) / (B08 + B04)$ (kondycja biomasy)
  - $NDMI = (B08 - B11) / (B08 + B11)$ (uwilgotnienie roślinności)
  Wartości porównywane z medianą 10-letnią dla tej samej działki i pory roku.
- **Polowa Pojemność Wodna (AWC):**
  Szacowana równaniami pedotransferowymi Saxtona & Rawlsa na podstawie uziarnienia i zawartości próchnicy.

---

## 6. Obowiązkowa Sekwencja Raportu (Wymóg KOWR)
Wyniki muszą być zwracane i wyświetlane w ściśle określonej kolejności:
1. **Etap 1: Diagnoza stanu wody i identyfikacja przyczyn niedoboru** (aktualny KBW, anomalia NDVI, retencja glebowa, czy woda ucieka przez spadek / lekki piasek).
2. **Etap 2: Dobór działań retencyjnych i agrotechnicznych** (Zasada: *"Retain water where it falls"* – bezwzględny priorytet retencji krajobrazowej i glebowej: zastawki na rowach, międzyplony, mulczowanie, uprawa bezorkowa).
3. **Etap 3: Opcjonalne rekomendacje nawadniania** (wyłącznie interwencyjnie: dawka w mm lub $m^3/ha$, sugerowany termin i technika).
4. **Metadane i transparentność:** Jawny wykaz źródeł danych, daty zobrazowań satelitarnych oraz lista ograniczeń analizy (`limitations`).

---

## 7. Główne Kontrakty API Backendu
- `GET /api/parcel/search?teryt={teryt}` – szybkie pobranie granic działki, powierzchni w ha i punktu centralnego do zoomu mapy. Format TERYT: `WWPPGG_R.OOOO.NR_DZIAŁKI`.
- `POST /api/analyze` – pełna analiza:
  ```json
  {
    "teryt": "141201_1.0001.123/4",
    "crop": "kukurydza",
    "target_date": "2026-07-15"
  }
  ```
- `GET /api/health` – status dostępności usług zewnętrznych (ULDK, Open-Meteo, AWS STAC).


---

## 4. 5 Wymaganych Źródeł Danych i Obsługa Przestrzenna
Każde zapytanie przetwarza dane z 5 niezależnych kategorii:
1. **Granice działki:** ULDK GUGiK (`uldk.gugik.gov.pl`). Transformacja geometrii z układu polskiego `EPSG:2180` do `EPSG:4326` (WGS84). Użycie `shapely.representative_point()` zamiast centroidu (obsługa działek nieregularnych / litery L).
2. **Pogoda (10 lat + prognoza):** Open-Meteo API. Pobranie sum opadów ($P$), temperatury oraz ewapotranspiracji referencyjnej ($ET_0$ Penmana-Monteitha) jednym zapytaniem HTTP.
3. **Satelita (kondycja roślin):** AWS Earth Search STAC (Sentinel-2 L2A COG). Pasma B04 (Red), B08 (NIR), B11 (SWIR) oraz maska chmur SCL w oknie ostatnich 21 dni. Odczyt wyłącznie pikseli działki.
   - *Fallback:* Przy trwałym zachmurzeniu (>15% w całym oknie) nie wyrzucamy błędu – raport oznacza NDVI jako niedostępne z adnotacją w `limitations`.
4. **Gleba:** ISRIC SoilGrids REST API. Frakcje piasku, pyłu, iłu oraz węgiel organiczny (SOC) dla warstwy 0–30 cm.
5. **Rzeźba terenu i hydrologia:** Geoportal NMT WCS (obliczenie średniego nachylenia stoku) + Overpass API / BDOT10k WFS (wykrywanie cieków i rowów melioracyjnych w buforze 500 m).

---

## 5. Algorytmy i Metodyka Agrohydrologiczna
- **Klimatyczny Bilans Wodny (KBW):**
  $$KBW = P - (ET_0 \times K_c)$$
  Wyliczany dla okresów 30- i 60-dniowych. Współczynniki roślinne $K_c$ pobierane ze słownika upraw (metodyka FAO-56).
- **Wskaźniki Teledetekcyjne:**
  - $NDVI = (B08 - B04) / (B08 + B04)$ (kondycja biomasy)
  - $NDMI = (B08 - B11) / (B08 + B11)$ (uwilgotnienie roślinności)
  Wartości porównywane z medianą 10-letnią dla tej samej działki i pory roku.
- **Polowa Pojemność Wodna (AWC):**
  Szacowana równaniami pedotransferowymi Saxtona & Rawlsa na podstawie uziarnienia i zawartości próchnicy.

---

## 6. Obowiązkowa Sekwencja Raportu (Wymóg KOWR)
Wyniki muszą być zwracane i wyświetlane w ściśle określonej kolejności:
1. **Etap 1: Diagnoza stanu wody i identyfikacja przyczyn niedoboru** (aktualny KBW, anomalia NDVI, retencja glebowa, czy woda ucieka przez spadek / lekki piasek).
2. **Etap 2: Dobór działań retencyjnych i agrotechnicznych** (Zasada: *"Retain water where it falls"* – bezwzględny priorytet retencji krajobrazowej i glebowej: zastawki na rowach, międzyplony, mulczowanie, uprawa bezorkowa).
3. **Etap 3: Opcjonalne rekomendacje nawadniania** (wyłącznie interwencyjnie: dawka w mm lub $m^3/ha$, sugerowany termin i technika).
4. **Metadane i transparentność:** Jawny wykaz źródeł danych, daty zobrazowań satelitarnych oraz lista ograniczeń analizy (`limitations`).

---

## 7. Główne Kontrakty API Backendu
- `GET /api/parcel/search?teryt={teryt}` – szybkie pobranie granic działki, powierzchni w ha i punktu centralnego do zoomu mapy. Format TERYT: `WWPPGG_R.OOOO.NR_DZIAŁKI`.
- `POST /api/analyze` – pełna analiza:
  ```json
  {
    "teryt": "141201_1.0001.123/4",
    "crop": "kukurydza",
    "target_date": "2026-07-15"
  }
  ```
- `GET /api/health` – status dostępności usług zewnętrznych (ULDK, Open-Meteo, AWS STAC).