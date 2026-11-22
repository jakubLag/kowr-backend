# Plan naprawczy i techniczny projektu KOWR (HackNation 2026)

> [!NOTE]
> **Zakres dokumentu:** Propozycja konkretnych rozwiązań dla wszystkich braków, błędów merytorycznych, cichych fallbacków, niespójności oraz wymagań formalnych wykrytych w audycie projektu — **z wyłączeniem podpinania na żywo 10-letniego archiwum meteorologicznego Open-Meteo** (`fetch_10y_climatology` / Krok 1.1 oraz dni `+17..+60` liczonych z 10-letnich norm punktowych).

---

## 1. Eliminacja cichych fallbacków i błędów czasowych (Krok 1.3)

### 1.1. ULDK — koniec z fikcyjną geometrią działki
**Pliki:** [uldk.py](backend/app/services/gis/uldk.py), [parcel.py](backend/app/api/routes/parcel.py), [analyze.py](backend/app/api/routes/analyze.py), [config.py](backend/app/core/config.py)

**Problem:** W `fetch_parcel_from_uldk` ([uldk.py#L250-L257](backend/app/services/gis/uldk.py#L250-L257)) brak odpowiedzi lub nieistniejący TERYT uruchamia `generate_fallback_geometry(teryt)` i zwraca sztuczny poligon jako prawidłowy wynik. Dodatkowo `/api/parcel/search` łapie wszystkie wyjątki jako HTTP `500`, a `/api/analyze` jako `400`.

**Rozwiązanie:**
1. W `config.py` dodać flagę `ALLOW_MOCK_ULDK: bool = os.getenv("ALLOW_MOCK_ULDK", "false").lower() == "true"` (domyślnie `False`, włączana wyłącznie w testach offline).
2. W `fetch_parcel_from_uldk`:
   * Jeśli ULDK zwróci `200`, ale treść zaczyna się od `-1` (działka nie istnieje) w obu żądaniach (`GetParcelById` i `GetParcelByIdOrNr`) → rzucić `ParcelNotFoundError(f"Nie odnaleziono działki o identyfikatorze TERYT: {teryt}")`.
   * Jeśli wystąpi błąd HTTP != 200, timeout, tarpit (`len(resp.content) >= 50_000`) lub `blocked for abuse` → jeśli `settings.ALLOW_MOCK_ULDK` jest `True`, użyć `generate_fallback_geometry(teryt)` z `is_fallback=True`; w przeciwnym razie rzucić `UldkServiceError("Usługa ewidencji gruntów GUGiK (ULDK) jest chwilowo niedostępna.")`.
   * Nie zapisywać do `parcel_cache` odpowiedzi z `is_fallback=True`.
3. W [parcel.py#L23-L27](backend/app/api/routes/parcel.py#L23-L27) oraz [analyze.py#L49-L52](backend/app/api/routes/analyze.py#L49-L52) dodać jawne mapowanie wyjątków (identyczne jak w `/api/parcel/by-point`):
   * `ParcelNotFoundError` → `HTTPException(status_code=404, detail=...)`
   * `UldkServiceError` → `HTTPException(status_code=502, detail=...)`

---

### 1.2. Sentinel-2 — usunięcie sztucznego `ndmi = 0.22` i ujednolicenie progu chmur
**Pliki:** [satellite.py](backend/app/services/gis/satellite.py), [config.py](backend/app/core/config.py)

**Problem:**
* W [satellite.py#L204](backend/app/services/gis/satellite.py#L204) i [satellite.py#L374](backend/app/services/gis/satellite.py#L374) przy braku odczytu pasma SWIR/B11 wstawiane jest sztuczne `ndmi_current = 0.22`.
* W [config.py#L6](backend/app/core/config.py#L6) `CLOUD_COVER_MAX = 40`, podczas gdy AWS STAC ([satellite.py#L343](backend/app/services/gis/satellite.py#L343)) oraz wszystkie komunikaty mówią o `< 15%`.

**Rozwiązanie:**
1. Zmienić `CLOUD_COVER_MAX: int = 15` w `config.py` i użyć tej samej stałej zarówno w `fetch_indices_from_cdse`, jak i w ścieżce AWS STAC.
2. W obu miejscach w `satellite.py` zamienić `else 0.22` na `else None` (frontend w `Step1Assessment.tsx` już poprawnie wyświetla `"Brak danych"` dla `ndmi_current == null`).
3. Dodać w zwracanym słowniku pola techniczne:
   * `"provider": "Copernicus CDSE" | "AWS Earth Search STAC" | None`
   * `"from_cache": True | False` (ustawiane przy odczycie z `_SATELLITE_CACHE`, bez nadpisywania obiektu w cache — zwracać `{**_SATELLITE_CACHE[cache_key], "from_cache": True}`).
4. Nie zapisywać do `_SATELLITE_CACHE` wyników wynikających z przejściowego błędu połączenia (`is_fallback=True` spowodowanego wyjątkiem sieciowym).

---

### 1.3. SoilGrids — pełny profil do 100 cm, `awc_root_zone_mm` i naprawa cache
**Pliki:** [soil.py](backend/app/services/gis/soil.py), [schemas.py](backend/app/models/schemas.py), [analyze.py](backend/app/api/routes/analyze.py), [Step1Assessment.tsx](frontend/src/components/report/Step1Assessment.tsx)

**Problem:**
* [soil.py#L26](backend/app/services/gis/soil.py#L26) pobiera tylko `0-5cm`, `5-15cm`, `15-30cm` (brak warstw głębszych i `awc_root_zone_mm`).
* [soil.py#L86](backend/app/services/gis/soil.py#L86) zapisuje do nieograniczonego słownika `_SOIL_CACHE` również wyniki z `is_fallback=True` (jednorazowy timeout psuje wyniki dla działki do restartu serwera).

**Rozwiązanie:**
1. Zamienić `_SOIL_CACHE: Dict` na `TTLCache(maxsize=500, ttl=86400)` i cachować **wyłącznie** odpowiedzi z `is_fallback == False`.
2. Rozszerzyć `depth` w zapytaniu SoilGrids na:
   `["0-5cm", "5-15cm", "15-30cm", "30-60cm", "60-100cm"]`.
3. Obliczyć w `soil.py`:
   * parametry dla **warstwy ornej 0–30 cm** (średnia ważona miąższością: `5 cm`, `10 cm`, `15 cm`) → `awc_mm` (bez zmiany dotychczasowej skali IUNG/Saxton-Rawls),
   * tablicę miąższości i jednostkowej retencji `awc_fraction` dla podwarstw `0-30`, `30-60`, `60-100` cm oraz funkcję pomocniczą `calculate_root_zone_awc(soil_data, root_depth_m) -> Optional[float]` sumującą retencję w strefie korzeniowej danej uprawy (np. 0,6 m dla ziemniaka, 0,9 m dla kukurydzy, 1,2 m dla rzepaku — przy czym dla głębokości > 100 cm ekstrapolować z warstwy 60–100 cm).
   * Jeśli `is_fallback == True`, ustawić `awc_root_zone_mm = None` (nie udawać precyzji głębokiego profilu bez danych z SoilGrids).
4. Dodać pole `awc_root_zone_mm: Optional[float] = None` do `Diagnosis` w `schemas.py` (frontend w [analysis.ts#L111](frontend/src/types/analysis.ts#L111) już ma ten typ) i wyświetlić je w tabeli `1.4` w [Step1Assessment.tsx#L734-L746](frontend/src/components/report/Step1Assessment.tsx#L734-L746) jako: *„AWC warstwy ornej (0–30 cm): X mm • AWC strefy korzeniowej uprawy (0–Y cm): Z mm”*.

---

### 1.4. Pogoda — naprawa `wind_max_7d`, brak „znajomości przyszłości” dla dat archiwalnych i jawny `forecast_kind`
**Pliki:** [weather.py](backend/app/services/gis/weather.py), [analyze.py](backend/app/api/routes/analyze.py), [schemas.py](backend/app/models/schemas.py), [report_generator.py](backend/app/services/science/report_generator.py)

**Problemy:**
1. **Bug w `wind_max_7d`:** [analyze.py#L222-L224](backend/app/api/routes/analyze.py#L222-L224) bierze `raw_daily_series[-16:]`, czyli dni `+45..+60` (końcówkę syntetycznego scenariusza klimatologicznego!), zamiast pierwszych 7 dni prognozy po `target_date`.
2. **Wyciek przyszłości (data leakage) dla dat archiwalnych:** Dla `target_date = 2019-07-15` backend przekazuje do `generate_irrigation_recommendation` realne opady z `2019-07-16..22`, przez co raport z 15 lipca potrafi wstrzymać nawadnianie „bo prognozowany jest deszcz”.
3. **Brak pola `forecast_kind` na backendzie:** Frontend zgaduje granicę dni 1..16 vs 17..60.
4. **Cichy fallback meteo przy awarii Open-Meteo:** W [weather.py#L285-L298](backend/app/services/gis/weather.py#L285-L298) wstawiane są sztywne liczby `38.0 mm / 115.0 mm`.

**Rozwiązanie:**
1. Dodać do `DailyWeatherPoint` w `schemas.py` pole:
   `forecast_kind: Literal["historical", "synoptic_16d", "climatology", "ex_post"] = "historical"`.
2. W `_parse_weather_response` (`weather.py`) oznaczać każdy punkt wprost:
   * `d_str <= anchor_str` → `"historical"`
   * `d_str > anchor_str` oraz `is_archive == True` → `"ex_post"`
   * `d_str > anchor_str` oraz `is_archive == False`: pierwsze 16 dni z Open-Meteo → `"synoptic_16d"`, kolejne dni `+17..+60` → `"climatology"`.
   * Zwrócić flagę `"is_archive": is_archive` w słowniku z `fetch_weather_data`.
3. Naprawić `wind_max_7d` w `analyze.py`:
   ```python
   next_7d = [pt for pt in weather_data.get("raw_daily_series", []) if pt.get("is_forecast")][:7]
   wind_max_7d = max((pt.get("wind_max_ms") or 0.0 for pt in next_7d), default=0.0)
   ```
4. Przekazać `is_archive: bool` do `generate_irrigation_recommendation`:
   * Jeśli `is_archive == True`, **nie używać** `forecast_7d_precip_mm` ani `wind_max_7d` do modyfikacji decyzji nawadniania (nie wstrzymywać nawadniania i nie zmieniać pory z powodu zdarzeń po `target_date`); ustawić `weather_window_status = "ARCHIWALNA"`.
5. Obsługa awarii Open-Meteo (zgodnie z pkt 3.3.5 KOWR — **zero pozornej precyzji, bez zmyślonych liczb `38.0 / 115.0`**):
   * Dodać `TTLCache(maxsize=500, ttl=3600)` dla zapytań pogodowych oraz 1 szybkie ponowienie (retry z backoff 0.5 s) w `fetch_weather_data`.
   * Jeśli Open-Meteo całkowicie zawiedzie (i brak wpisu w cache) — **nie podstawiać syntetycznych opadów/ET0**! Zamiast tego zwrócić w raporcie:
     * `kbw_30d_mm = None`, `kbw_60d_mm = None`, `precipitation_30d_mm = None`, `et0_30d_mm = None`, `daily_weather_series = None`, `forecast_60d_decades = None`,
     * `drought_risk_level = "BRAK DANYCH"`, `kbw_status = "Dane meteorologiczne chwilowo niedostępne (Open-Meteo)"`,
     * w Etapie 2 nadal wygenerować **strukturalne** zalecenia retencyjne wynikające z gleby (AWC), spadku terenu, rowów i mokradeł,
     * w Etapie 3 zablokować wyliczanie dawki: `needed = False`, `dose_mm = 0.0`, `status = "Brak danych meteorologicznych — nie można wyliczyć dawki nawadniania"`,
     * w `metadata`: wpis w `limitations`, `fetched_mode = "unavailable"` w `data_sources` oraz kara `-30%` w `confidence_score_percent` (`confidence_level = "OBNIŻONA"`).
   * Na froncie (`Step1Assessment.tsx`, `BasicFarmerReport.tsx`, `raport/page.tsx`) bezpiecznie obsłużyć `kbw_30d_mm == null` / `kbw_60d_mm == null`, wyświetlając `"Brak danych"` w komórkach i ukrywając wykresy KBW z czytelnym komunikatem.

---

## 2. Poprawki merytoryczne silnika naukowego (Kroki 2.1 i 2.2)

### 2.1. Pełna synchronizacja fenologii upraw (oziminy vs jare)
**Pliki:** [crops.py](backend/app/services/science/crops.py), [analyze.py](backend/app/api/routes/analyze.py), [crops.ts](frontend/src/lib/crops.ts)

**Problem:** Backend wylicza $K_c$ i referencyjne NDVI z uproszczonych 3 wartości (`kc_initial/mid/end` + `is_winter`), co powoduje rozjazd z frontendem (np. pszenica ozima w kwietniu: backend `1.15` vs front `0.85`; rzepak w czerwcu: `1.10` vs `0.70`; jęczmień w sierpniu: `1.15` vs `0.25`). Ponadto `_growth_stage_for_month(m)` w `analyze.py` nie uwzględnia uprawy.

**Rozwiązanie:**
1. W `CROP_DATABASE` w `crops.py` dodać dla każdej z 10 upraw dwie pełne mapy miesięczne (1..12):
   * `kc_by_month: Dict[int, float]` — 1:1 zgodne z [crops.ts](frontend/src/lib/crops.ts#L19-L249) (warto też rozważyć rozbicie lub jawny opis `jeczmien` jako jęczmień ozimy/jary, spójnie z mapą $K_c$),
   * `ndvi_by_month: Dict[int, float]` — realistyczne krzywe fenologiczne (np. `pszenica_ozima`: IV=`0.68`, V=`0.80`, VI=`0.78`, VII=`0.48`, VIII=`0.25`; `rzepak`: IV=`0.72`, V=`0.76`, VI=`0.55`, VII=`0.28`, VIII=`0.25`; `kukurydza`: IV=`0.22`, V=`0.32`, VI=`0.62`, VII=`0.82`, VIII=`0.80`, IX=`0.52`).
2. Przepisać `get_crop_kc(crop_name, month)` i `get_crop_ndvi_reference(crop_name, month)` tak, by czytały wprost z `kc_by_month[month]` i `ndvi_by_month[month]`.
3. Dodać w `crops.py` funkcję `get_crop_growth_stage(crop_name: str, month: int) -> str` (zgodną z `getMonthGrowthStageDescription` na froncie) i zastąpić nią lokalne `_growth_stage_for_month(m)` w [analyze.py#L245-L256](backend/app/api/routes/analyze.py#L245-L256).

---

### 2.2. Poprawki `decision_engine.py`, `fao56.py` i `report_generator.py`
**Pliki:** [decision_engine.py](backend/app/services/science/decision_engine.py), [fao56.py](backend/app/services/science/fao56.py), [report_generator.py](backend/app/services/science/report_generator.py), [reportHelpers.ts](frontend/src/lib/reportHelpers.ts)

**Rozwiązanie punkt po punkcie:**
1. **Usunięcie błędnych komunikatów o spadku i rowach:**
   * W [report_generator.py#L141-L146](backend/app/services/science/report_generator.py#L141-L146) zastąpić błędne zdanie (*„rowy nie wpływają negatywnie na nawodnienie”*) poprawnym komunikatem:
     *„Działka znajduje się zaledwie {dist_val} m od rowu melioracyjnego przy niewielkim spadku terenu ({slope_val:.1f}%), co stwarza bardzo dobre warunki do piętrzenia wody zastawką i zasilania podsiąkowego strefy korzeniowej uprawy {crop_val}.”*
   * W [decision_engine.py#L55-L56](backend/app/services/science/decision_engine.py#L55-L56) usunąć dopisywanie `else: primary_causes.append(...)` dla małego spadku — do przyczyn niedoboru trafiają wyłącznie czynniki generujące deficyt (lub nadmiar przy `is_waterlogged`).
2. **Uwzględnienie wrażliwości uprawy (`drought_sensitivity`) i głębokości korzenienia (`root_depth_m` / `awc_root_zone_mm`):**
   * Pobierać rekord uprawy z `CROP_DATABASE` w `evaluate_rules`.
   * Dla upraw o wrażliwości `BARDZO WYSOKA` (ziemniak) i płytkim korzenieniu (`root_depth_m <= 0.6`, tj. ziemniak, łąka/TUZ) obniżyć próg wyzwalania nawadniania interwencyjnego z `kbw_30d < -50` do `kbw_30d < -40`, a dla upraw o niskiej wrażliwości (`NISKA`, żyto ozime) podnieść do `kbw_30d < -65`.
   * Przy deficycie (`kbw_30d < -35`) dla upraw o wrażliwości `WYSOKA`/`BARDZO WYSOKA` dodać wpis w `primary_causes`, np.: *„Uprawa ({name_pl}) charakteryzuje się {drought_sensitivity.lower()} wrażliwością na suszę oraz strefą korzeniową {root_depth_m} m (faza krytyczna: {critical_phase}).”*
   * Przy obliczaniu `max_single_dose` wykorzystać `effective_awc = awc_root_zone_mm or awc_mm` z bezpiecznym limitem warstwy ornej (`min(35.0, max(15.0, awc_mm * 0.75))`), aby dawka nie powodowała przesiąkania poza warstwę korzeniową.
3. **Nowa reguła strefy buforowej przy ciekach (`WATERWAY_BUFFER_STRIP`):**
   * Wyzwalana w `decision_engine.py`, gdy `distance_to_ditch_m is not None and distance_to_ditch_m <= 150` (Priorytet 2, kategoria `landscape`).
   * Zalecenie: utrzymanie 3–5 m zadarnionej strefy buforowej wzdłuż cieku/rowu (ograniczenie spływu biogenów, stabilizacja brzegów, wsparcie bioróżnorodności i mikroretencji; powiązanie z GAEC 4).
4. **Ujednolicenie logiki okna pogodowego w Etapie 3:**
   * Zmienić próg wiatru w [report_generator.py#L218](backend/app/services/science/report_generator.py#L218) z `> 6.0` na `> 5.0` m/s (spójnie z planem i `reportHelpers.ts`).
   * Dla `is_archive == False` i `forecast_7d_precip_mm >= 15.0`:
     * jeśli `forecast_7d_precip_mm >= deficit_mm` → ustawić `needed = False`, `dose_mm = 0.0`, `weather_window_status = "WSTRZYMAJ_OPADY"`, `status = "Zalecane wstrzymanie nawadniania — prognozowany deszcz pokrywa deficyt"`;
     * jeśli `15.0 <= forecast_7d_precip_mm < deficit_mm` → zredukować dawkę o `round(forecast_7d_precip_mm * 0.7, 1)` i ustawić `weather_window_status = "WSTRZYMAJ_OPADY"` z zaleceniem wstrzymania zabiegu do czasu weryfikacji opadu.
5. **Ujednolicenie katalogu Ekoschematów ARiMR / WPR 2023–2027:**
   * Uzgodnić jeden spójny zestaw nazw, realnych kodów i orientacyjnych stawek pomiędzy [report_generator.py](backend/app/services/science/report_generator.py) a [reportHelpers.ts](frontend/src/lib/reportHelpers.ts):
     * `SOIL_LOW_AWC_COVER_CROP` → *Rolnictwo węglowe — Międzyplony ozime lub wsiewki śródplonowe* (`E_MPW`, ~435 PLN/ha)
     * `NO_TILL_EVAPORATION_REDUCTION` → *Rolnictwo węglowe — Uproszczone systemy uprawy / Wymieszanie słomy z glebą* (`E_USU / E_WSG`, ~250 PLN/ha)
     * `CONTOUR_FARMING_SLOPE` → *Norma GAEC 5 + Ekoschemat: Uproszczone systemy uprawy* (`GAEC 5 / E_USU`, ~250 PLN/ha)
     * `RETENTION_DITCH_WEIR` → dla `crop == "laka"` przypisać **Ekoschemat: Retencjonowanie wody na trwałych użytkach zielonych** (`E_RET`, ~260 PLN/ha), dla gruntów ornych *Inwestycje w małą retencję rolniczą / spółki wodne (PS WPR 2023–2027)* (`I.10.4`).
     * `WINDBREAK_SHELTERBELT` → *Interwencja PS WPR: Zakładanie zadrzewień śródpolnych i systemów rolno-leśnych* (`I.10.10 / I.10.11`, ~1100 PLN/ha).
     * `WATERWAY_BUFFER_STRIP` → *Norma GAEC 4 (strefy buforowe wzdłuż cieków wodnych)*.

---

## 3. Ustrukturyzowane metadane `data_sources` i poziom pewności (Krok 2.3)

**Pliki:** [schemas.py](backend/app/models/schemas.py), [analyze.py](backend/app/api/routes/analyze.py), [TransparencyBox.tsx](frontend/src/components/report/TransparencyBox.tsx)

**Problem:** Backend nie wysyła `data_sources: List[DataSourceMeta]`, `generated_at` ani `confidence_explanation`, a w `sources` i `data_freshness` wpisuje na sztywno nazwy nieużytych serwisów (np. CDSE bez kluczy, GUGiK NMT gdy DEM pochodził z Open-Meteo Elevation).

**Rozwiązanie:**
1. Dodać w `schemas.py`:
   ```python
   class DataSourceMeta(BaseModel):
       name: str
       category: str
       fetched_mode: Literal["live", "cached", "static", "unavailable"]
       data_freshness: str
       spatial_resolution: str
       license: str
   ```
2. Rozszerzyć `ReportMetadata` o:
   * `generated_at: str` (ISO timestamp, zachowując `analysis_date` dla kompatybilności wstecznej),
   * `data_sources: List[DataSourceMeta]`,
   * `confidence_level: Literal["WYSOKA", "ŚREDNIA", "OBNIŻONA"]`,
   * `confidence_score_percent: int` (oraz alias/pole `confidence_score` równe tej samej wartości),
   * `confidence_explanation: str`.
3. W `analyze.py` budować `data_sources` oraz `sources` **dynamicznie wyłącznie z faktycznie użytych źródeł**:
   * **Kataster:** ULDK GUGiK (`live` lub `cached` na podstawie `from_cache`, rozdzielczość: granice EGiB, licencja: otwarte dane publiczne GUGiK).
   * **Meteorologia:** Open-Meteo Archive / Forecast API (`live` / `cached` / `unavailable`, zakres: 60 dni do `target_date` + prognoza 16 dni dla daty bieżącej, rozdzielczość: ~9–11 km, licencja: CC BY 4.0 — plan niekomercyjny).
   * **Teledetekcja:** faktyczny `sentinel_data["provider"]` (`Copernicus CDSE` albo `AWS Earth Search STAC`), tryb `live` / `cached` / `unavailable`, aktualność: `scene_date` lub `"brak bezchmurnej sceny (<15%)"`, rozdzielczość `10–20 m`, licencja: `Copernicus Open Access`.
   * **Gleba:** ISRIC SoilGrids v2.0 (`live` / `cached` / `unavailable`, rozdzielczość `250 × 250 m`, licencja `CC BY 4.0`).
   * **Rzeźba terenu (DEM):** faktyczny `terrain_data["dem_source"]` (`Open-Meteo Elevation DEM` albo `Geoportal NMT (GUGiK)`), tryb `live` / `cached` / `unavailable`.
   * **Hydrografia i krajobraz:** OpenStreetMap Overpass API (`live` / `cached` / `unavailable`, bufor 500 m / 300 m, licencja `ODbL 1.0`) + lokalna baza stacji IMGW-PIB (`static`, stan z `2026-11-21`, otwarte dane publiczne).
4. Zaktualizować formułę `confidence_score_percent` i generowanie `confidence_explanation`:
   * Start `100%`:
     * `-25%` gdy `sentinel_data["ndvi_current"] is None` (lub `-10%` przy chmurach > 15%),
     * `-20%` gdy `soil_data["is_fallback"]` jest `True`,
     * `-15%` gdy `terrain_data["dem_available"] is False`,
     * `-15%` gdy `terrain_data["hydro_data_available"] is False`,
     * `-30%` gdy `weather_data["is_fallback"]` jest `True`.
   * `confidence_explanation` złożyć automatycznie z listy powodów obniżenia (np. *„Pewność średnia (75%) — brak bezchmurnego zobrazowania satelitarnego Sentinel-2 w oknie 21 dni; pozostałe źródła (pogoda, gleba, DEM, hydrografia) pobrano poprawnie.”*).
   * Usunąć w `analyze.py#L418` sztywny wpis `"Numeryczny Model Terenu GUGiK / OpenStreetMap"` na rzecz realnego `dem_source`.

---

## 4. Uzupełnienia frontendowe (bez 10-letniej historii)

**Pliki:** [Step1Assessment.tsx](frontend/src/components/report/Step1Assessment.tsx), [BasicFarmerReport.tsx](frontend/src/components/report/BasicFarmerReport.tsx), [ParcelMap.tsx](frontend/src/components/ParcelMap.tsx)

1. **Wyświetlenie `awc_root_zone_mm`:** dodać w wierszu gleby w tabeli `1.4` (`Step1Assessment.tsx`), gdy pole nie jest `null`.
2. **Obsługa braku danych meteo (`kbw_30d_mm == null` / `kbw_60d_mm == null`):** w `Step1Assessment.tsx`, `BasicFarmerReport.tsx` i `raport/page.tsx` wyświetlać jawne `"Brak danych"` oraz komunikat o niedostępności danych pogodowych (bez zmyślonych liczb i wykresu fallbackowego).
3. **Weryfikacja warstwy EDO Copernicus WMS ([ParcelMap.tsx#L376](frontend/src/components/ParcelMap.tsx#L376)):**
   * Zweryfikować w przeglądarce (zakładka Network) czy `https://drought.emergency.copernicus.eu/api/wms` z `layers="cdiad"` zwraca kafelki PNG `200 OK`; jeśli nie, przełączyć na oficjalny endpoint z dokumentacji EDO (`https://drought.emergency.copernicus.eu/data/wms-service` lub właściwą nazwę warstwy z `GetCapabilities`).

---

## 5. Bezpieczeństwo, konfiguracja i testy (Faza 4)

### 5.1. Konfiguracja i walidacja `target_date` (Krok 4.1)
**Pliki:** [config.py](backend/app/core/config.py), [schemas.py](backend/app/models/schemas.py), [frontend/.env.example](frontend/.env.example), [frontend/.gitignore](frontend/.gitignore)

1. W `config.py` wczytywać `ALLOWED_ORIGINS` ze zmiennej środowiskowej:
   ```python
   _default_origins = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,https://145.239.90.237.nip.io,https://kowr-front.vercel.app"
   ALLOWED_ORIGINS: List[str] = [
       origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", _default_origins).split(",") if origin.strip()
   ]
   ```
2. W `AnalyzeRequest` (`schemas.py`) dodać walidator Pydantic v2 dla `target_date`:
   * Jeśli `target_date` jest podany: zweryfikować format `YYYY-MM-DD` (`date.fromisoformat`), odrzucić daty starsze niż `date.today() - timedelta(days=3653)` (10 lat) oraz daty z przyszłości (`> date.today()`).
   * Błąd walidacji automatycznie zwróci czytelny HTTP `422 Unprocessable Entity`.
3. Uzupełnić [frontend/.env.example](frontend/.env.example):
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```
4. Dopisać `.env` do [frontend/.gitignore](frontend/.gitignore) (obok `.env*.local`) oraz zweryfikować przez `git status` / `git ls-files`, że `backend/.env` i `frontend/.env` nie są śledzone w repozytorium.

---

### 5.2. Rozszerzenie pakietu testów `pytest` i weryfikacja `< 30 s` (Krok 4.2)
**Pliki:** [test_science.py](backend/tests/test_science.py), [test_api.py](backend/tests/test_api.py), [test_satellite.py](backend/tests/test_satellite.py)

1. **`test_science.py`:**
   * Testy fenologii ozimin vs jarych: `pszenica_ozima` (V vs VIII: `Kc=1.15` vs `0.25`, faza *Kłoszenie* vs *Po żniwach / ściernisko*), `rzepak` (V vs VII), `kukurydza` (IV vs VII).
   * Test wrażliwości na suszę: `ziemniak` vs `zyto` przy tym samym `kbw_30d = -45 mm` (ziemniak wymaga nawadniania, żyto nie).
   * Test okna pogodowego: opad 7d `>= 15 mm` wstrzymuje/redukuje dawkę; wiatr `> 5 m/s` uruchamia `OSTRZEZENIE_WIATR`; `is_archive=True` ignoruje opady po badanej dacie.
   * Zaktualizować `test_decision_engine_low_slope_ditch` (płaski teren nie jest przyczyną niedoboru wody; zastawka nie zawiera błędnego zdania o rowach).
2. **`test_api.py`:**
   * Testy walidacji `target_date`: zły format (`"15-07-2024"`), data sprzed >10 lat (`"2010-07-15"`), data z przyszłości (`"2030-01-01"`) → wszystkie zwracają HTTP `422`.
   * Testy ULDK dla `/api/parcel/search`: kod `-1` → `404`, timeout → `502`.
   * Test **braku pozornej precyzji** dla `POST /api/analyze` (z mockami timeoutów SoilGrids + Overpass + STAC + DEM + Open-Meteo): sprawdzenie, że brakujące wskaźniki to `None`, lista `metadata.limitations` zawiera wpisy dla każdej niedostępnej usługi, `metadata.data_sources` ma `fetched_mode="unavailable"`, a `metadata.confidence_level == "OBNIŻONA"`.
   * Uniezależnić `test_parcel_search_endpoint` i `test_analyze_endpoint` od sieci (mockowane odpowiedzi), a testy na żywo dla 5 prawdziwych działek TERYT z różnych regionów Polski (nizina/gleba lekka, podgórze ze spadkiem >3%, gleba ciężka, susza 2019-07-15, bieżąca data) z asercją czasu odpowiedzi `< 30 s` wydzielić pod marker `@pytest.mark.live`.
3. **Weryfikacja PDF (manualna przed oddaniem):**
   * Przetestować `Ctrl+P` / `Cmd+P` → PDF A4 w Chrome, Firefox i Edge oraz widok mobilny (DevTools 390×844) dla trybu podstawowego i szczegółowego.

---

## 6. Dokumentacja `README.md` i pakiet zgłoszeniowy (Faza 5)

### 6.1. Poprawki w [README.md](README.md) i [backend/README.md](backend/README.md) (Krok 5.1)

| Miejsce w `README.md` | Wykryty problem | Konkretna poprawka |
| :--- | :--- | :--- |
| [Linia 5](README.md#L5) | Stara nazwa repo `miki/backend_kowr` | Zaktualizować do nazwy docelowego prywatnego repo konkursowego. |
| Sekcja 1 ([L25-L95](README.md#L25-L95)) | Brak linku do działającego prototypu online; w [L84](README.md#L84) opis nieistniejącego przełącznika **„Tryb: Tylko Mock”** | Usunąć blok o trybie Mock; dodać link do wdrożonej wersji online (URL frontu + URL Swaggera) oraz instrukcję `cp .env.example .env.local`. |
| Sekcja 2 ([L108](README.md#L108), [L127-L128](README.md#L127-L128)) | „Ponad 15 upraw” (w kodzie jest 10); opis nieistniejącego „Symulatora Retencji SOC” | Poprawić na **10 głównych upraw**; zastąpić opis symulatora rzeczywistymi funkcjami: **Raport podstawowy vs szczegółowy**, **Porównanie płodozmianu (`CropRotationComparison`)** oraz **Mini-ranking działek w „Moje gospodarstwo”**. |
| Sekcje 4 i 5 ([L182-L210](README.md#L182-L210)) | Brakuje **Open-Meteo Elevation / GUGiK NMT** oraz **EDO Copernicus WMS** | Dopisać brakujące źródła do obu tabel wraz z rozdzielczością, trybem pobrania (`live`/`cached`/`static`) i datą aktualności. |
| **Sekcja 7 ([L297](README.md#L297))** | **Błąd licencyjny Open-Meteo** (*„Dozwolony użytek komercyjny”*) | Poprawić na: *CC BY 4.0 dla danych; bezpłatne API `open-meteo.com` wyłącznie do użytku niekomercyjnego (prototyp konkursowy). W wdrożeniu produkcyjnym: płatny plan komercyjny Open-Meteo, własna instancja open-source Open-Meteo (AGPLv3) lub bezpośrednia integracja z otwartymi danymi **IMGW-PIB** (zgodnie z pkt 5.4).* |
| Sekcja 9 ([L324](README.md#L324)) | Nieaktualna liczba testów (`17`) i stara punktacja Confidence Index | Zaktualizować liczbę testów po uruchomieniu `pytest` oraz uzgodnić wagi Confidence Index z kodem w `analyze.py`. |
| [backend/README.md](backend/README.md) | Nieaktualny opis (brak CDSE, Open-Meteo Elevation, `/by-point`) | Skrócić do krótkiego przewodnika deweloperskiego backendu z linkiem do głównego `README.md` (analogicznie do `frontend/README.md`). |

---

### 6.2. Plan przygotowania załączników konkursowych (Krok 5.2)

1. **Przykładowe raporty PDF (3 różne scenariusze z działającej aplikacji):**
   * **Scenariusz A (Susza na glebie lekkiej):** działka nizinna (np. Wielkopolska / Mazowsze), uprawa `kukurydza`, data `2019-07-15` (głęboki deficyt, międzyplony, zastawka/retencja, nawadnianie interwencyjne).
   * **Scenariusz B (Teren podgórski ze spadkiem > 3%):** działka w Małopolsce / na Podkarpaciu, uprawa `pszenica_ozima` lub `ziemniak`, data `2024-06-15` (aktywna reguła `CONTOUR_FARMING_SLOPE` + kierunek spływu na mapie).
   * **Scenariusz C (Nadmiar wody / brak suszy):** działka w mokrym okresie (np. wiosna/jesień po intensywnych opadach) — pokazuje, że system nie poleca ślepo nawadniania ani zamykania zastawek przy nadmiarze wody.
2. **Prezentacja PDF (maks. 10 slajdów):**
   * 1: Tytuł + nazwa zespołu (bez imion i nazwisk) • 2: Problem rolnika i KOWR • 3: Nasze rozwiązanie (3 kroki, 0 barier, 0 LLM) • 4: Źródła danych i architektura • 5: Etap 1 — Diagnoza (KBW, AWC, Sentinel-2, DEM, hydro) • 6: Etap 2 — Priorytet retencji + Ekoschematy ARiMR • 7: Etap 3 — Interwencyjne nawadnianie + okno pogodowe • 8: Transparentność i brak pozornej precyzji (`Confidence Index`, `limitations`) • 9: Weryfikacja (testy `pytest`, czas < 5 s) • 10: Skalowalność krajowa i koszty wdrożenia w KOWR.
3. **Film demo (maks. 3 minuty):**
   * `0:00–0:45` Wybór działki kliknięciem na mapie (KIEG + opcjonalnie warstwa EDO WMS) i po TERYT.
   * `0:45–1:15` Wybór uprawy i daty (pokazanie różnicy fenologii i trybu historycznego).
   * `1:15–2:30` Przejście przez Raport Podstawowy → Raport Szczegółowy (Etap 1: bilans, Sentinel-2, mapa cieku; Etap 2: retencja + ARiMR; Etap 3: nawadnianie + 6 dekad; Sekcja 4: pewność i źródła).
   * `2:30–3:00` Eksport do PDF (A4) i powrót do mini-rankingu działek w „Moje gospodarstwo”.

---

## 7. Rekomendowana kolejność wdrożenia

| Kolejność | Blok prac | Szacowany czas |
| :---: | :--- | :---: |
| **1** | **Backend — dane i brak cichych fallbacków:** ULDK (`404`/`502` + `ALLOW_MOCK_ULDK`), Sentinel-2 (`ndmi=None`, `CLOUD_COVER_MAX=15`), SoilGrids (warstwy do 100 cm + `awc_root_zone_mm` + fix cache), pogoda (fix `wind_max_7d`, brak wycieku przyszłości dla `is_archive`, `forecast_kind`, brak zmyślonych liczb przy awarii Open-Meteo). | ~1,5 h |
| **2** | **Backend — nauka i metadane:** synchronizacja `kc_by_month` / `ndvi_by_month` / `get_crop_growth_stage`, poprawa `decision_engine.py` i `report_generator.py` (zdanie o rowach, wrażliwość uprawy, próg wiatru 5 m/s, strefa buforowa, ekoschematy), `data_sources` + `confidence_explanation`. | ~1,5 h |
| **3** | **Frontend + konfiguracja + testy:** `awc_root_zone_mm` i obsługa `kbw == null` (`"Brak danych"`), weryfikacja EDO WMS, `ALLOWED_ORIGINS` z env, walidacja `target_date` (`422`), `.env.example`, pełny zestaw testów `pytest`. | ~1 h |
| **4** | **Dokumentacja i oddanie:** poprawki w `README.md` (zwłaszcza licencja Open-Meteo i usunięcie nieistniejących funkcji), weryfikacja wydruku PDF, wygenerowanie 3 raportów PDF, slajdy (≤ 10) i film (≤ 3 min). | ~1,5 h |
