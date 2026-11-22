# „Zatrzymaj wodę, chroń plony” – Platforma Inteligentnego Audytu Wodnego i Retencji Glebowej

**Projekt:** „Zatrzymaj wodę, chroń plony” – Inteligentne wsparcie gospodarowania wodą w rolnictwie  
**Konkurs:** HackNation 2026 • Zadanie Krajowego Ośrodka Wsparcia Rolnictwa (KOWR)  
**Lokalizacja repozytorium:** `miki/backend_kowr` (Monorepo: `backend/` + `frontend/`)  
**Status prawno-licencyjny:** W 100% Otwarte Oprogramowanie (Open Source) oraz Otwarte Dane Publiczne (Open Data)  
**Paradygmat nadrzędny:** **Zero barier wejścia dla rolnika** (0 PLN, RWD/Mobile, prosty interfejs) • **Zero halucynacji** (brak LLM w silniku decyzyjnym, 100% determinizm i audytowalność naukowo-agronomiczna)

---

## Spis Treści (Zgodność z Wymogami Konkursowymi KOWR)
1. [Instrukcja uruchomienia rozwiązania](#1-instrukcja-uruchomienia-rozwiązania)
2. [Opis podstawowych funkcjonalności](#2-opis-podstawowych-funkcjonalności)
3. [Skrócony opis architektury rozwiązania](#3-skrócony-opis-architektury-rozwiązania)
4. [Opis wykorzystanych źródeł i zakresów danych](#4-opis-wykorzystanych-źródeł-i-zakresów-danych)
5. [Tryb pozyskiwania danych (na bieżąco vs. przetworzone wcześniej) oraz obliczenia](#5-tryb-pozyskiwania-danych-na-bieżąco-vs-przetworzone-wcześniej-oraz-obliczenia)
6. [Wykaz bibliotek, komponentów, modeli, usług zewnętrznych i narzędzi AI](#6-wykaz-bibliotek-komponentów-modeli-usług-zewnętrznych-i-narzędzi-ai)
7. [Licencje i warunki korzystania z danych i komponentów](#7-licencje-i-warunki-korzystania-z-danych-i-komponentów)
8. [Opis znanych ograniczeń technicznych rozwiązania](#8-opis-znanych-ograniczeń-technicznych-rozwiązania)
9. [Informacja o sposobie weryfikacji wygenerowanych wyników i rekomendacji](#9-informacja-o-sposobie-weryfikacji-wygenerowanych-wyników-i-rekomendacji)
10. [Dostępność, skalowalność krajowa i koszty utrzymania](#10-dostępność-skalowalność-krajowa-i-koszty-utrzymania)

---

## 1. Instrukcja uruchomienia rozwiązania

Rozwiązanie zostało zorganizowane jako monorepo zawierające niezależny backend REST API (`backend/`) oraz nowoczesny frontend internetowy (`frontend/`).

### Wymagania wstępne
* **Backend:** Python 3.11+ (zalecany Python 3.12 oraz menedżer `uv` lub klasyczny `venv`/`pip`)
* **Frontend:** Node.js 18+ (zalecany Node.js 20 LTS) oraz menedżer `npm`

---

### Krok 1: Uruchomienie Backendu (FastAPI)

1. Przejdź do katalogu backendu:
   ```bash
   cd backend
   ```
2. Utwórz i aktywuj środowisko wirtualne:
   ```bash
   # Opcja A (zalecana - błyskawiczna z 'uv'):
   uv venv
   source .venv/bin/activate
   uv pip install -r requirements.txt

   # Opcja B (standardowa przez pip):
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
3. *(Opcjonalnie)* Skonfiguruj plik zmiennych środowiskowych `.env` (w katalogu głównym lub `backend/` znajduje się wzorzec `.env.example`). Podstawowa analityka działa natychmiast bez konieczności podawania płatnych kluczy.
4. Uruchom serwer API:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   * **Adres API:** `http://localhost:8000`
   * **Interaktywna dokumentacja Swagger UI:** `http://localhost:8000/docs`
   * **Dokumentacja ReDoc:** `http://localhost:8000/redoc`

---

### Krok 2: Uruchomienie Frontendu (Next.js 14)

1. W nowym oknie terminala przejdź do katalogu frontendu:
   ```bash
   cd frontend
   ```
2. Zainstaluj zależności npm:
   ```bash
   npm install
   ```
3. Uruchom serwer deweloperski:
   ```bash
   npm run dev
   ```
4. Otwórz w przeglądarce:
   ```
   http://localhost:3000
   ```

> [!TIP]
> **Tryb Demonstracyjny / Offline:** Frontend posiada wbudowany przełącznik **„Tryb: Tylko Mock”** w górnym pasku nawigacyjnym. Pozwala on na natychmiastowe przetestowanie pełnego interfejsu i wygenerowanie przykładowego audytu wodnego nawet przy wyłączonym serwerze backendowym lub braku łączności z internetem.

---

### Krok 3: Uruchomienie testów zautomatyzowanych
Aby zweryfikować poprawność obliczeń naukowych, pedotransferowych i kontraktów API:
```bash
cd backend
source .venv/bin/activate
pytest
```

---

## 2. Opis podstawowych funkcjonalności

System stanowi kompleksowe narzędzie doradztwa agrohydrologicznego dla rolników, doradców ODR oraz inspektorów KOWR. Do kluczowych funkcjonalności należą:

1. **Identyfikacja i lokalizacja działki ewidencyjnej:**
   * Wyszukiwanie działki po 14-znakowym identyfikatorze TERYT (np. `141201_1.0001.123/4`),
   * Wskazanie działki bezpośrednio na interaktywnej mapie Polski jednym kliknięciem (odpytanie ULDK GUGiK metodą `by-point`),
   * Automatyczne pobranie geometrii granic działki, powierzchni w hektarach oraz wyznaczenie punktu reprezentatywnego.

2. **Dobór uprawy i parametrów agronomicznych:**
   * Baza ponad 15 głównych upraw rolniczych w Polsce (kukurydza, pszenica ozima/jara, rzepak, burak cukrowy, ziemniak, TUZ itd.),
   * Automatyczne dopasowanie dynamicznego współczynnika roślinnego $K_c$ w zależności od fazy fenologicznej uprawy w wybranym miesiącu.

3. **Trzyetapowy Audyt Wodny (zgodnie z obligatoryjną sekwencją KOWR):**
   * **Etap 1: Diagnoza stanu wody i deficytu:**
     * Obliczenie Klimatycznego Bilansu Wodnego ($KBW = P - ET_c$) w oknach 30- i 60-dniowych,
     * Klasyfikacja ryzyka suszy w oparciu o urzędowe kryteria IUNG-PIB dla 4 kategorii agronomicznych gleby,
     * Wyliczenie Polowej Pojemności Wodnej (AWC) i Punktu Trwałego Więdnięcia (WP) profilu glebowego 0–30 cm,
     * Ocena kondycji biomasy i wilgotności łanu przy użyciu wskaźników satelitarnych NDVI i NDMI (Sentinel-2 L2A) wraz z analizą anomalii względem normy wieloletniej,
     * Wizualizacja 120-dniowego kroczącego bilansu wodnego (60 dni historii + 60 dni prognozy w 6 dekadach),
     * Oszacowanie 10-letniej historycznej podatności działki na suszę rolniczą.
   * **Etap 2: Dobór działań retencyjnych (Zasada: *Retain water where it falls*):**
     * Priorytetyzacja retencji glebowej (międzyplony, mulczowanie, obornik, uprawa bezorkowa) i krajobrazowej (zastawki na rowach melioracyjnych w promieniu 500 m),
     * Bezpośrednie powiązanie każdego zalecenia ze stawkami dopłat z **Ekoschematów WPR 2023–2027** (stawki punktowe i PLN/ha).
   * **Etap 3: Opcjonalne rekomendacje nawadniania interwencyjnego:**
     * Wyliczane wyłącznie w sytuacji realnego zagrożenia plonów i wyczerpania bufora glebowego,
     * Precyzyjne dawki w $mm$ oraz $m^3/ha$ dostosowane do aktualnej pojemności retencyjnej (AWC), aby uniknąć przelania gleby i wymywania składników,
     * Wskazanie optymalnego okna czasowego z uwzględnieniem prognozy opadów i siły wiatru.

4. **Symulator Retencji Glebowej w Czasie Rzeczywistym (Interactive Simulator):**
   * Interaktywne narzędzie pozwalające rolnikowi symulować wpływ agrotechniki (np. zwiększenie materii organicznej SOC, siew międzyplonów) na zysk pojemności wodnej w $mm$ oraz zyskane dodatkowe dni odporności na suszę.

5. **Wydruk urzędowy i eksport do formatu PDF:**
   * Dedykowane arkusze stylów `@media print` generujące czytelny, profesjonalny audyt w standardzie GovDesignSystem z pełną metryką źródeł danych i wskaźnikiem wiarygodności (*Confidence Index*).

---

## 3. Skrócony opis architektury rozwiązania

Aplikacja została zaprojektowana w architekturze mikrousługowo-monorepozytoryjnej zoptymalizowanej pod kątem wysokiej wydajności, odporności na awarie serwisów państwowych oraz transparentności obliczeń:

```
                                    +-----------------------------------------------+
                                    |     PRZEGLĄDARKA INTERNETOWA ROLNIKA          |
                                    |  (Next.js 14 / TypeScript / Tailwind / RWD)   |
                                    +-----------------------+-----------------------+
                                                            |  JSON REST API
                                                            v
+-------------------------------------------------------------------------------------------------------------------+
|                                            BACKEND FASTAPI (Python 3.12)                                          |
|                                                                                                                   |
|  [ API Router ] ---> /api/parcel/search, /api/parcel/by-point, /api/analyze, /api/crops, /api/health              |
|                                                                                                                   |
|  [ Asynchroniczny Fan-Out (asyncio.gather z Graceful Degradation) ]                                               |
|       |                     |                      |                     |                    |                   |
|       v                     v                      v                     v                    v                   |
|  +---------+          +------------+         +------------+        +-----------+        +-------------+           |
|  |  GUGiK  |          | Open-Meteo |         | Copernicus |        |   ISRIC   |        | IMGW / OSM  |           |
|  |  ULDK   |          |  Pogoda    |         | Sentinel-2 |        | SoilGrids |        | Cieki i     |           |
|  | Kataster|          | 60d+60d    |         | NDVI, NDMI |        | Profil    |        | Rowy 500m   |           |
|  +----+----+          +-----+------+         +-----+------+        +-----+-----+        +------+------+           |
|       |                     |                      |                     |                     |                  |
|       +---------------------+----------------------+---------------------+---------------------+                  |
|                                                            | Surowe parametry środowiskowe                        |
|                                                            v                                                      |
|  [ DETERMINISTYCZNY SILNIK NAUKOWY (ZERO LLM / 100% REPRODUCIBLE) ]                                               |
|       * fao56.py          -> Ewapotranspiracja Penmana-Monteitha ET0 i ETc, bilans KBW                            |
|       * saxton_rawls.py   -> Równania pedotransferowe AWC, WP, gęstość objętościowa gleby                         |
|       * decision_engine.py-> Klasyfikacja suszy IUNG-PIB, reguły retencji i nawadniania                           |
|       * report_generator  -> Szablonowanie ustrukturyzowanych zaleceń agronomicznych                              |
+-------------------------------------------------------------------------------------------------------------------+
```

### Kluczowe zasady architektoniczne:
* **Asynchroniczny fan-out (`asyncio.gather`):** Wszystkie zewnętrzne źródła danych pobierane są równolegle w czasie **1.5–3.5 s** (zamiast >15 s sekwencyjnie).
* **Wielopoziomowy Caching:** Podręczna pamięć RAM `TTLCache` (czas odpowiedzi dla powtórzonych zapytań: **< 1 ms**).
* **Odporność na awarie (Graceful Degradation):** Przy chwilowej niedostępności dowolnego rejestru państwowego (np. przestój ULDK, zachmurzenie w Sentinel-2, awaria API IMGW) system automatycznie aktywuje referencyjne modele regionalne i odnotowuje ten fakt w metryce transparentności raportu.

---

## 4. Opis wykorzystanych źródeł i zakresów danych

Rozwiązanie wykorzystuje wyłącznie oficjalne, otwarte dane publiczne o zasięgu ogólnopolskim:

| Lp. | Zbiór danych | Źródło / Dysponent | Zakres przestrzenny | Zakres czasowy / Rozdzielczość | Zastosowanie w projekcie |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Kataster EGiB (ULDK)** | Główny Urząd Geodezji i Kartografii (GUGiK) | Cała Polska (dowolna działka ewidencyjna) | Stan aktualny na bieżąco; układ PUWG 1992 (`EPSG:2180`) | Pobieranie geometrii granic działki, powierzchni w ha oraz identyfikatora TERYT. |
| **2** | **Katalog zobrazowań Sentinel-2 L2A (BOA)** | Europejska Agencja Kosmiczna (ESA) / Copernicus via AWS Open Data | Cała Polska / Europa | Najświeższa scena z okna 21–30 dni; rozdzielczość piksela 10–20 m | Obliczanie wskaźników wegetacji i uwilgotnienia: NDVI (pasma B04, B08) oraz NDMI (pasma B08, B11) z maską chmur SCL. |
| **3** | **SoilGrids v2.0** | International Soil Reference and Information Centre (ISRIC, Holandia) | Globalny z pokryciem całej Polski | Warstwa orna 0–30 cm; rozdzielczość siatki 250 m | Zawartość frakcji piasku, pyłu, iłu (%) oraz węgla organicznego (SOC, g/kg) do obliczeń AWC. |
| **4** | **ERA5 & DWD ICON Reanalysis** | ECMWF / DWD via Open-Meteo API | Cała Polska (siatka modelu ok. 11 km) | 60 dni historii + 60 dni prognozy (krok 1-dniowy) | Dobowe sumy opadów ($P$), ewapotranspiracja referencyjna ($ET_0$), temperatury min/max, prędkość wiatru. |
| **5** | **Pomiary hydrologiczne IMGW-PIB** | Instytut Meteorologii i Gospodarki Wodnej – PIB | Cała Polska (881 stacji wodowskazowych) | Pomiary operacyjne ze stacji; bufor odległości do działki | Identyfikacja najbliższej rzeki, odległość do działki, bieżący stan wody (cm). |
| **6** | **Sieć hydrograficzna OpenStreetMap** | Społeczność OSM via Overpass API | Bufor 500 m wokół działki | Wektory cieków i rowów melioracyjnych (`waterway=ditch/drain`) | Wykrywanie obecności rowów melioracyjnych na potrzeby rekomendacji zastawek piętrzących. |
| **7** | **Katalog Ekoschematów WPR 2023–2027** | Ministerstwo Rolnictwa i Rozwoju Wsi (MRiRW) / ARiMR | Cała Polska | Obowiązujący okres programowania Wspólnej Polityki Rolnej | Baza stawek dopłat (PLN/ha i punkty) dla zabiegów retencyjnych i poprawy struktury gleby. |

---

## 5. Tryb pozyskiwania danych (na bieżąco vs. przetworzone wcześniej) oraz obliczenia

Zgodnie z wymaganiami konkursowymi system ściśle rozgranicza dane pozyskiwane w czasie rzeczywistym od danych przygotowanych lokalnie:

### Podział trybu pozyskiwania danych:

| Zasób danych | Tryb pozyskiwania | Data pobrania / Aktualności | Mechanizm i lokalizacja w kodzie |
| :--- | :--- | :--- | :--- |
| **Granice działki i TERYT** | **Na bieżąco (Real-Time)** | Bieżący stan katastru GUGiK | Odpytanie ULDK GUGiK API per żądanie użytkownika (`app/services/gis/uldk.py`). |
| **Meteorologia i prognoza** | **Na bieżąco (Real-Time)** | 60 dni wstecz i 60 dni w przód od daty analizy | Zapytanie do Open-Meteo Archive & Forecast API per współrzędne działki (`app/services/gis/weather.py`). |
| **Wskaźniki satelitarne (NDVI/NDMI)** | **Na bieżąco (Real-Time)** | Najświeższa dostępna bezchmurna scena (<15% chmur) z ostatnich 21–30 dni | Przeszukiwanie katalogu STAC / CDSE i odczyt fragmentów GeoTIFF przez HTTP Range Requests (`app/services/gis/satellite.py`). |
| **Profil glebowy (ISRIC)** | **Na bieżąco (Real-Time)** | Dane stałe (wersja SoilGrids v2.0) | Zapytanie REST API dla punktu centralnego działki (`app/services/gis/soil.py`). |
| **Rowy i cieki w buforze 500 m** | **Na bieżąco (Real-Time)** | Bieżący stan bazy przestrzennej OSM | Zapytanie OverpassQL w promieniu 500 m (`app/services/gis/terrain.py`). |
| **Rejestr stacji hydrologicznych IMGW-PIB** | **Pobrane i przetworzone wcześniej (Offline/Cache)** | **21 listopada 2026 r.** | Skompresowana baza 881 stacji hydrologicznych osadzona w `app/data/imgw_stations.json` (skrypt odświeżający: `update_stations.py`). |
| **Klimatologiczne normy miesięczne Polski** | **Opracowane wcześniej (Fallback)** | **Listopad 2026 r.** (normy wieloletnie IUNG/IMGW) | Tablica referencyjnych norm opadów i $ET_0$ dla miesięcy I–XII w `app/services/gis/weather.py`. |
| **Katalog stawek Ekoschematów WPR** | **Przetworzone wcześniej** | **Sezon 2026 r.** (stawki MRiRW/ARiMR) | Baza wiedzy powiązana z regułami agronomicznymi w `app/services/science/decision_engine.py`. |
| **Katalog upraw i współczynników $K_c$** | **Opracowane wcześniej** | Opracowanie na podstawie FAO-56 | Słownik fenologiczny 15 upraw w `app/services/science/crops.py`. |

### Zasada nadrzędna: Obliczanie wyników przez aplikację
> [!IMPORTANT]
> **Aplikacja nie pobiera z zewnątrz żadnych gotowych ocen suszy ani gotowych rekomendacji.**  
> Wszystkie wyniki, diagnozy, bilanse i zalecenia są **w 100% obliczane samodzielnie przez silnik aplikacji** na podstawie wyżej wymienionych danych wejściowych:
> 1. Na podstawie surowych opadów i ewapotranspiracji silnik oblicza kroczący bilans wodny ($KBW = P - ET_c$),
> 2. Na podstawie udziału frakcji piasku, pyłu, iłu i SOC silnik rozwiązuje równania Saxtona-Rawlsa i wyznacza retencję glebową ($AWC$),
> 3. Na podstawie odległości do rowu, nachylenia stoku, kategorii gleby i $KBW$ deterministyczny silnik reguł generuje karty zaleceń retencyjnych i wylicza interwencyjną dawkę wody ($mm$ i $m^3/ha$).

---

## 6. Wykaz bibliotek, komponentów, modeli, usług zewnętrznych i narzędzi AI

### 6.1. Biblioteki programistyczne

#### Backend (`backend/requirements.txt` • Python 3.12+)
* **FastAPI (`>=0.110.0`)** – Nowoczesny framework REST API z automatyczną walidacją i dokumentacją OpenAPI.
* **Uvicorn (`>=0.28.0`)** – Asynchroniczny serwer ASGI o wysokiej przepustowości.
* **Pydantic (`>=2.6.0`)** – Typowanie kontraktów żądań i odpowiedzi JSON (Pydantic v2).
* **HTTPX (`>=0.27.0`)** – Asynchroniczny klient HTTP do zapytań zewnętrznych z poolingiem połączeń.
* **Shapely (`>=2.0.0`)** – Obliczenia geometryczne, tworzenie buforów 500 m, wyznaczanie `representative_point()`.
* **PyProj (`>=3.6.0`)** – Precyzyjne transformacje kartograficzne (PUWG 1992 `EPSG:2180` $\leftrightarrow$ WGS84 `EPSG:4326`).
* **Jinja2 (`>=3.1.3`)** – Deterministyczny silnik szablonowania raportów agronomicznych.
* **Cachetools (`>=5.5.0`)** – Algorytm pamięci podręcznej `TTLCache`.
* **Rasterio (`>=1.4.2`)** – Bezpośredni odczyt krojonych fragmentów rastra satelitarnego COG przez HTTP Range Requests.
* **Pandas (`>=2.2.0`) & NumPy (`>=1.26.4`)** – Szybkie agregacje szeregów czasowych bilansu meteo.
* **Pytest (`>=8.0.0`)** – Zautomatyzowane testy jednostkowe, integracyjne i agrohydrologiczne.

#### Frontend (`frontend/package.json` • Next.js 14 / TypeScript)
* **Next.js (`14.2.18`)** – Framework React z architekturą App Router i SSR.
* **React & React-DOM (`^18.3.1`)** – Deklaratywny interfejs użytkownika.
* **Leaflet (`^1.9.4`) & React-Leaflet (`^4.2.1`)** – Silnik map wektorowych i rastrowych WMS.
* **Recharts (`^2.13.3`)** – Responsywna wizualizacja 120-dniowego kroczącego bilansu wodnego.
* **Tailwind CSS (`^3.4.15`)** – System stylów oparty o GovDesignSystem z obsługą reguł druku `@media print`.
* **Lucide-React (`^0.460.0`)** – Semantyczny zestaw ikon rolniczych i nawigacyjnych.
* **TypeScript (`^5.6.3`)** – Statyczna kontrola typów w kodzie klienckim.

---

### 6.2. Autorskie Komponenty Aplikacji
* **`ReportHydroMap.tsx`**: Integracja warstw Leaflet GeoJSON (granica działki z ULDK, punkt reprezentatywny, promień oddziaływania rowu 500 m) z państwowymi podkładami rastrowymi WMS GUGiK (Ortofotomapa i KIEG).
* **`Step1Assessment.tsx`**: Prezentacja diagnozy stanu wody, wskaźnika ryzyka suszy, Polowej Pojemności Wodnej (AWC) oraz anomalii NDVI.
* **`Step2Retention.tsx`**: Rekomendacje retencji glebowej i krajobrazowej zintegrowane ze stawkami dopłat z Ekoschematów WPR.
* **`Step3Irrigation.tsx`**: Interwencyjne dawki nawodnienia w $mm$ oraz $m^3/ha$ wraz z optymalnym oknem czasowym.
* **`retentionSimulator.ts`**: Symulator wyliczający w locie zysk retencyjny gleby i dodatkowe dni bufora suszowego.
* **`TransparencyBox.tsx`**: Panel pełnej przejrzystości prezentujący źródła danych, daty pomiarów oraz listę ograniczeń analizy.

---

### 6.3. Modele Naukowe i Algorytmiczne
Wszystkie moduły analityczne w projekcie są **w 100% deterministyczne** i bazują na recenzowanych standardach naukowych:
1. **Model FAO-56 Penman-Monteith (FAO/ONZ):** (`backend/app/services/science/fao56.py`) – wyliczanie ewapotranspiracji referencyjnej ($ET_0$) i zapotrzebowania wodnego łanu ($ET_c = ET_0 \times K_c$).
2. **Model Pedotransferowy Saxtona & Rawlsa (2006):** (`backend/app/services/science/saxton_rawls.py`) – wyliczanie Polowej Pojemności Wodnej (AWC), Punktu Więdnięcia (WP) i gęstości gleby z frakcji piasku, pyłu, iłu i węgla organicznego SOC.
3. **Model Klimatycznego Bilansu Wodnego (KBW) IUNG-PIB:** (`backend/app/services/science/decision_engine.py`) – kroczący bilans wodny ($P - ET_c$) w oknach 30- i 60-dniowych oraz klasyfikacja ryzyka suszy dla kategorii glebowych.
4. **Deterministyczny silnik regułowy zaleceń:** (`backend/app/services/science/report_generator.py`) – regułowy dobór zabiegów agrotechnicznych i wyliczanie bezpiecznych dawek nawodnień.
5. **Deterministyczny model regionalny TERYT:** (`backend/app/services/gis/coordinates.py`) – mechanizm fallback dla geometrii działki w razie awarii API katastru.

---

### 6.4. Usługi Zewnętrzne i Interfejsy API
1. **ULDK GUGiK API** (`uldk.gugik.gov.pl`): Usługa Lokalizacji Działek Katastralnych.
2. **Geoportal WMS ORTOFOTOMAPA & KIEG** (`mapy.geoportal.gov.pl`, `integracja.gugik.gov.pl`): Państwowe serwisy kafelkowe OGC WMS (dyrektywa INSPIRE).
3. **Open-Meteo API** (`api.open-meteo.com` / `archive-api.open-meteo.com`): Pogoda archiwalna i prognozy synoptyczne.
4. **ISRIC SoilGrids REST API** (`rest.isric.org`): Właściwości profilu glebowego.
5. **OpenStreetMap Overpass API** (`overpass-api.de`): Zapytania hydrograficzne OverpassQL.
6. **IMGW-PIB Hydro API** (`danepubliczne.imgw.pl/api/data/hydro`): Bieżące stany wód na stacjach wodowskazowych.
7. **Copernicus CDSE / AWS STAC API**: Otwarty katalog zobrazowań satelitarnych Sentinel-2 L2A.

---

### 6.5. Deklaracja Użycia Narzędzi Sztucznej Inteligencji (AI Declaration)
* **Gwarancja braku LLM w silniku decyzyjnym (Zero Hallucination Guarantee):** W silniku obliczeń agrohydrologicznych, diagnozy suszy, wyliczania dawek nawodnień oraz doboru ekoschematów **nie zastosowano żadnego generatywnego modelu LLM**. Każda rekomendacja wynika z deterministycznych wzorów matematycznych i reguł agronomicznych.
* **Narzędzia AI wspomagające proces wytwórczy:** Podczas prac programistycznych wykorzystano narzędzie **Google DeepMind Antigravity / Gemini 3** wyłącznie w charakterze asystenta programistycznego do przyspieszenia pisania kodu TypeScript/Python, opracowania testów `pytest` oraz redakcji dokumentacji.

---

## 7. Licencje i warunki korzystania z danych i komponentów

Wszystkie wykorzystane komponenty i zbiory danych cechują się otwartym reżimem prawnym dopuszczającym ponowne wykorzystywanie:

| Kategoria | Komponent / Zbiór danych | Licencja / Podstawa prawna | Warunki korzystania |
| :--- | :--- | :--- | :--- |
| **Dane** | Kataster ULDK GUGiK, Geoportal WMS | Ustawa Prawo geodezyjne i kartograficzne (Dz.U. z 2020 r. poz. 276) | Ponowne wykorzystywanie informacji sektora publicznego (Public Domain). |
| **Dane** | Pomiary IMGW-PIB | Ustawa o ponownym wykorzystywaniu informacji sektora publicznego | Otwarte Dane Publiczne RP (bez opłat licencyjnych). |
| **Dane** | Sentinel-2 L2A | Copernicus Open Access Policy | Bezpłatny, pełny i otwarty dostęp do celów komercyjnych i badawczych. |
| **Dane** | SoilGrids v2.0 (ISRIC) | Creative Commons Attribution 4.0 (CC-BY 4.0) | Wymagane uznanie autorstwa; dozwolony użytek komercyjny. |
| **Dane** | Open-Meteo / ERA5 / ICON | CC-BY 4.0 / Open Database License | Dozwolony użytek komercyjny i badawczy. |
| **Dane** | OpenStreetMap (Overpass) | Open Database License (ODbL 1.0) | Otwarte dane społecznościowe; share-alike dla ulepszeń bazy. |
| **Dane** | Ekoschematy WPR 2023–2027 | Domena publiczna (akty prawne MRiRW / ARiMR) | Urzędowe materiały publiczne. |
| **Kod** | FastAPI, Pydantic, Jinja2, Pytest, Next.js, React, Tailwind, Recharts | Licencja MIT | Pełna swoboda użycia, modyfikacji i dystrybucji bez copyleft. |
| **Kod** | Uvicorn, HTTPX, Shapely, Rasterio, NumPy, Pandas | Licencja BSD-3-Clause | Dopuszczalny użytek komercyjny z zachowaniem noty prawnej. |
| **Kod** | TypeScript | Licencja Apache-2.0 | Standardowa licencja otwartego oprogramowania. |
| **Kod** | Lucide-React | Licencja ISC | Permisywna licencja open source równoważna MIT. |

---

## 8. Opis znanych ograniczeń technicznych rozwiązania

Zgodnie z zasadą pełnej transparentności inżynieryjnej wskazujemy znane uwarunkowania i ograniczenia techniczne systemu:

1. **Rozdzielczość przestrzenna profilu glebowego:** Baza SoilGrids v2.0 posiada rozdzielczość siatki 250 × 250 m. Odzwierciedla ona uśrednione warunki glebowe w strefie ornej 0–30 cm i może nie uchwycić lokalnych przewarstwień glebowych na bardzo małych działkach o wysokiej zmienności glebowej.
2. **Wpływ zachmurzenia na teledetekcję satelitarną:** Optyczne zobrazowania satelitarne Sentinel-2 są wrażliwe na pokrywę chmur. Przy zachmurzeniu przekraczającym 15% system nie dokonuje sztucznych halucynacji wskaźników NDVI/NDMI – zwraca wartość `null` i opiera diagnozę na fizycznym bilansie FAO-56.
3. **Limity zapytań publicznych API (Rate Limits):** Publiczne interfejsy ULDK GUGiK oraz Overpass API posiadają limity zapytań na minutę dla pojedynczego adresu IP. W fazie deweloperskiej zastosowano rotujące proxy; w docelowym wdrożeniu na infrastrukturze KOWR zaleca się dodanie adresów IP serwerów na białą listę (*whitelisting*) w GUGiK i IMGW.
4. **Modelowanie bilansu bez czujników *in-situ*:** Aplikacja bazuje na modelowaniu ewapotranspiracji Penmana-Monteitha i bilansie wodnym strefy korzeniowej. Nie posiada dostępu do fizycznych czujników wilgotności gleby ani piezometrów na badanej działce, dlatego wyniki stanowią wysoce prawdopodobne oszacowanie agrometeorologiczne.
5. **Rozdzielczość modeli pogodowych:** Dane reanalizy i prognozy Open-Meteo bazują na siatce o rozdzielczości ok. 11 km. W skrajnych przypadkach zjawisk konwekcyjnych (np. punktowa, gwałtowna letnia burza o zasięgu kilkuset metrów) lokalny opad na działce może różnić się od średniej dla komórki modelu.

---

## 9. Informacja o sposobie weryfikacji wygenerowanych wyników i rekomendacji

Prawidłowość działania algorytmów oraz wiarygodność generowanych zaleceń podlegają wielopoziomowej weryfikacji:

### 1. Zautomatyzowane testy jednostkowe i integracyjne (`pytest`)
Repozytorium zawiera pakiet 17 automatycznych testów jednostkowych (`backend/tests/`):
* **Weryfikacja równań FAO-56 (`test_science.py`):** Test sprawdza zgodność wyliczania Klimatycznego Bilansu Wodnego z definicją matematyczną: $KBW = P - (ET_0 \times K_c)$ oraz poprawność klasyfikacji progów suszowych IUNG.
* **Weryfikacja równań Saxtona-Rawlsa:** Test bada poprawność fizyczną wyliczania Polowej Pojemności Wodnej ($AWC > 0$) oraz relacji $\theta_{fc} > \theta_{wp}$ dla różnych frakcji granulometrycznych gleby.
* **Weryfikacja współczynników upraw $K_c$:** Test potwierdza dynamiczną zmianę współczynników roślinnych w kalendarzu fenologicznym (np. kukurydza: kwiecień $K_c = 0.35$, lipiec $K_c = 1.20$).
* **Weryfikacja silnika reguł decyzyjnych:** Sprawdzenie logiki aktywacji rekomendacji (np. odległość do rowu < 300 m aktywuje zastawkę melioracyjną, spadek terenu $\ge 3\%$ wymusza uprawę w poprzek stoku, wysoki deficyt w krytycznej fazie generuje dawkę nawodnienia).
* **Weryfikacja kontraktów API i sekwencji KOWR (`test_api.py`):** Sprawdzenie, czy odpowiedź JSON zawiera kompletną 3-etapową sekwencję (Krok 1: Diagnoza, Krok 2: Retencja, Krok 3: Nawadnianie, Krok 4: Metadane).

### 2. Walidacja fizyczna i agronomiczna (Sanity Checks)
* Dawki nawodnienia interwencyjnego są ograniczone od góry pojemnością retencyjną profilu glebowego ($AWC$), co uniemożliwia wygenerowanie zaleceń powodujących przelanie gleby, zastoiska wodne lub wymywanie azotu do wód gruntowych.
* Progi suszy są sztywno skalibrowane z urzędowymi wartościami krytycznymi IUNG-PIB dla poszczególnych kategorii agronomicznych gleby (od -130 mm dla gleb bardzo lekkich do -220 mm dla gleb ciężkich).

### 3. Wskaźnik Wiarygodności Danych (Confidence Index)
Każdy generowany raport zawiera automatycznie kalkulowany wskaźnik wiarygodności (0–100%):
* 100 pkt – kompletne dane ze wszystkich 5 niezależnych serwisów na żywo,
* -15 pkt – w przypadku użycia modelu zastępczego meteorologii,
* -20 pkt – w przypadku braku bezchmurnej sceny satelitarnej Sentinel-2,
* -20 pkt – w przypadku profilu referencyjnego gleby,
* -10 pkt – w przypadku braku numerycznego modelu terenu NMT.

### 4. Transparentność obliczeń (Audytowalność)
W komponencie `TransparencyBox.tsx` użytkownik otrzymuje pełen wgląd w daty pobrania każdego zasobu, czas wykonania analizy oraz listę ograniczeń. Żaden parametr nie jest generowany w sposób nieprzejrzysty.

---

## 10. Dostępność, skalowalność krajowa i koszty utrzymania

### Paradygmat „Zero Barier Wejścia dla Rolnika”
* **0 PLN kosztów dla rolnika:** Usługa funkcjonuje w modelu bezpłatnego doradztwa publicznego.
* **Brak konieczności instalacji:** Pełne działanie w przeglądarce mobilnej i desktopowej (Chrome, Firefox, Safari, Edge).
* **Obsługa dowolnej działki w Polsce:** Integracja z ogólnokrajową bazą TERYT i katastrem GUGiK (ponad 30 milionów działek).

### Skalowalność i szacunkowe koszty utrzymania w skali Polski

| Komponent infrastruktury | Specyfikacja produkcyjna | Szacunkowy koszt komercyjny | Koszt wdrożenia w KOWR |
| :--- | :--- | :--- | :--- |
| **Serwery aplikacyjne (API Backend)** | 2x VPS (8 vCPU, 16 GB RAM, High Availability) | ok. 350 – 500 PLN / mies. | **0 PLN** (istniejąca chmura/serwery KOWR) |
| **Baza danych przestrzennych (PostGIS)** | Managed PostgreSQL 16 + PostGIS (100 GB NVMe) | ok. 300 – 450 PLN / mies. | **0 PLN** (infrastruktura państwowa) |
| **In-Memory Cache (Redis)** | Klaster buforowania sesji i zapytań katastralnych (8 GB) | ok. 100 – 150 PLN / mies. | **0 PLN** |
| **Hosting Frontendu (Next.js)** | Kontenery Docker (Chmura Rządowa / Kubernetes) | ok. 80 – 150 PLN / mies. | **0 PLN** |
| **Zewnętrzne API (GUGiK, IMGW, Open-Meteo)** | Whitelisting IP w GUGiK / IMGW | ok. 200 – 350 PLN / mies. | **0 PLN** (wymiana międzyresortowa) |
| **ŁĄCZNY KOSZT UTRZYMANIA SYSTEMU:** | **Gotowość do obsługi całego kraju (24/7)** | **ok. 1 000 – 1 500 PLN / mies.** | **0 PLN / mies.** |