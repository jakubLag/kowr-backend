"""
Generator kart zaleceń i ustrukturyzowanego raportu.
Zastępuje LLM deterministycznymi szablonami eksperckimi zgodnymi z wytycznymi KOWR.
Sekwencja:
Etap 1: Diagnoza stanu wody i przyczyny deficytu
Etap 2: Dobór działań retencyjnych i agrotechnicznych
Etap 3: Opcjonalne rekomendacje nawadniania
Metadane i ograniczenia
"""

from typing import List, Dict, Any
from app.models.schemas import RetentionAction, IrrigationRecommendation

EXPERT_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "RETENTION_DITCH_WEIR": {
        "title": "Budowa zastawki szandorowej na rowie melioracyjnym",
        "badge": "Retencja krajobrazowa (Priorytet 1)",
        "why": "Działka posiada nachylenie {slope:.1f}% i znajduje się zaledwie {dist_m} m od rowu melioracyjnego. Zastawka spowolni odpływ i podniesie poziom wód gruntowych w strefie korzeniowej {crop}.",
        "action": "Zainstaluj zastawkę szandorową lub próg piętrzący na rowie przed okresem wiosennych roztopów i zamknij odpływ po osiągnięciu bezpiecznego poziomu wody.",
        "water_gain_mm": 25.0,
        "drought_buffer_days": 7,
        "ecoscheme_name": "Inwestycje w małą retencję rolniczą / spółki wodne (PS WPR 2023–2027)",
        "ecoscheme_code": "I.10.4",
        "ecoscheme_pln_per_ha": None,
    },
    "SOIL_LOW_AWC_COVER_CROP": {
        "title": "Wprowadzenie międzyplonów i mulczowania",
        "badge": "Retencja glebowa (Priorytet 2)",
        "why": "Gleba w klasie '{soil_category}' posiada niską retencję użyteczną (AWC: {awc:.1f} mm). Woda szybko przesiąka poniżej warstwy korzeniowej {crop}.",
        "action": "Zastosuj siew międzyplonów ścierniskowych (np. facelia, gorczyca, rzodkiew oleista) i pozostaw mulcz na zimę. Każdy 1% materii organicznej zatrzymuje do 150 m³ wody na hektar.",
        "water_gain_mm": 22.0,
        "drought_buffer_days": 6,
        "ecoscheme_name": "Ekoschemat: Rolnictwo węglowe — Międzyplony ozime lub wsiewki śródplonowe",
        "ecoscheme_code": "E_MPW",
        "ecoscheme_pln_per_ha": 435,
    },
    "NO_TILL_EVAPORATION_REDUCTION": {
        "title": "Uprawa bezorkowa lub pasowa (Strip-Till)",
        "badge": "Ochrona wilgoci glebowej (Priorytet 2)",
        "why": "Deficyt parowania osiągnął KBW: {kbw_30d:.1f} mm. Tradycyjna orka odkrywkowa powoduje gwałtowną utratę nawet 15-25 mm wody w ciągu pierwszych 48 godzin od zabiegu.",
        "action": "Zastąp tradycyjną orkę płużną głęboszowaniem bezodwracającym lub technologią Strip-Till, pozostawiając resztki pożniwne na powierzchni pola.",
        "water_gain_mm": 18.0,
        "drought_buffer_days": 5,
        "ecoscheme_name": "Ekoschemat: Rolnictwo węglowe — Uproszczone systemy uprawy / Wymieszanie słomy z glebą",
        "ecoscheme_code": "E_USU / E_WSG",
        "ecoscheme_pln_per_ha": 250,
    },
    "CONTOUR_FARMING_SLOPE": {
        "title": "Uprawa w poprzek stoku i pasy zadarnione",
        "badge": "Retencja stokowa i antyerozja (Priorytet 2)",
        "why": "Nachylenie terenu {slope:.1f}% powoduje szybki spływ powierzchniowy wody opadowej, unosząc cenną próchnicę i uniemożliwiając wsiąkanie.",
        "action": "Wykonuj wszelkie zabiegi uprawowe wyłącznie prostopadle do kierunku stoku (wzdłuż warstwic) oraz utwórz pas buforowy z trwałej darni w najniższym punkcie spływu.",
        "water_gain_mm": 20.0,
        "drought_buffer_days": 5,
        "ecoscheme_name": "Norma GAEC 5 (zarządzanie uprawą ograniczające erozję) + Ekoschemat: Uproszczone systemy uprawy",
        "ecoscheme_code": "GAEC 5 / E_USU",
        "ecoscheme_pln_per_ha": 250,
    },
    "WATERWAY_BUFFER_STRIP": {
        "title": "Utrzymanie zadarnionej strefy buforowej wzdłuż cieku lub rowu",
        "badge": "Retencja krajobrazowa i ochrona wód (Priorytet 2)",
        "why": "Działka graniczy z ciekiem lub rowem melioracyjnym w odległości {dist_m} m. Pas roślinności przybrzeżnej spowalnia spływ powierzchniowy, stabilizuje skarpy i ogranicza wymywanie biogenów z uprawy ({crop}).",
        "action": "Pozostaw wzdłuż rowu lub cieku pas nieoranej, zadarnionej strefy buforowej o szerokości 3–5 m (bez stosowania nawozów i środków ochrony roślin).",
        "water_gain_mm": 12.0,
        "drought_buffer_days": 3,
        "ecoscheme_name": "Norma GAEC 4 (strefy buforowe wzdłuż cieków wodnych)",
        "ecoscheme_code": "GAEC 4",
        "ecoscheme_pln_per_ha": None,
    },
    "MICRO_RETENTION_POND": {
        "title": "Budowa niecki chłonnej lub oczka mikro-retencyjnego",
        "badge": "Mikro-retencja wodna (Priorytet 3)",
        "why": "Powierzchnia {area_ha:.2f} ha generuje znaczną objętość spływu burzowego podczas nawalnych deszczy przy łącznym deficycie 60-dniowym KBW {kbw_60d:.1f} mm.",
        "action": "Utwórz w naturalnym obniżeniu terenu bezodpływową nieckę bioretencyjną lub mały staw śródpolny do 1000 m², co kwalifikuje się do dofinansowania z programów retencyjnych KOWR / ARiMR.",
        "water_gain_mm": 45.0,
        "drought_buffer_days": 12,
        "ecoscheme_name": "Inwestycje w gospodarstwach w zakresie małej retencji (stawy i oczka do 1000 m²)",
        "ecoscheme_code": "RET_ARIMR_02",
        "ecoscheme_pln_per_ha": None,
    },
    "DRAINAGE_DITCH_OPEN_WEIR": {
        "title": "Regulacja odpływu na rowie melioracyjnym (odprowadzenie nadmiaru wody)",
        "badge": "Melioracja dwukierunkowa (Priorytet 1)",
        "why": "Na działce występuje znaczna nadwyżka wody (KBW 30d: +{kbw_30d:.1f} mm), a w odległości {dist_m} m znajduje się rów melioracyjny. Zbyt wysoki poziom wody grozi uduszeniem systemu korzeniowego uprawy ({crop}).",
        "action": "Otwórz zastawkę piętrzącą i udrożnij przepusty na rowie melioracyjnym do czasu odprowadzenia wody zastoiskowej, a po ustabilizowaniu wilgotności ponownie zamknij zastawkę, aby zachować rezerwę na okres letni.",
        "water_gain_mm": None,
        "drought_buffer_days": None,
        "ecoscheme_name": "Utrzymanie urządzeń melioracji wodnych",
        "ecoscheme_code": "MEL_01",
        "ecoscheme_pln_per_ha": None,
    },
    "SOIL_WATERLOGGING_SUBSOILING": {
        "title": "Głęboszowanie przełamujące podeszwę płużną i ochrona przed ugniataniem",
        "badge": "Napowietrzenie profilu glebowego (Priorytet 1)",
        "why": "Nadmiar opadów (+{kbw_30d:.1f} mm) przekroczył pojemność wodną warstwy ornej (AWC: {awc:.1f} mm), powodując wypchnięcie powietrza z porów glebowych i powstawanie zastoisk powierzchniowych.",
        "action": "Wstrzymaj wjazd ciężkim sprzętem na przelaną glebę (aby nie zniszczyć jej struktury), a po obeschnięciu wykonaj głęboszowanie (35–45 cm) ułatwiające przesiąkanie nadmiaru wody do głębszych warstw.",
        "water_gain_mm": None,
        "drought_buffer_days": None,
        "ecoscheme_name": "Zabiegi agromelioracyjne na gruntach ornych",
        "ecoscheme_code": "MEL_02",
        "ecoscheme_pln_per_ha": None,
    },
    "WETLAND_POND_PROTECTION": {
        "title": "Ochrona i strefa buforowa przy oczkach wodnych lub mokradłach",
        "badge": "Retencja krajobrazowa (Priorytet 2)",
        "why": "W promieniu 500 m od działki zidentyfikowano naturalne oczka wodne, zbiorniki lub mokradła, które stabilizują lokalny mikroklimat i zasilają wody gruntowe dla uprawy ({crop}).",
        "action": "Nie osuszaj ani nie zasypuj obniżeń z wodą. Utrzymuj 3–5 m zadarnionej strefy buforowej wokół zbiornika/mokradła bez stosowania nawozów i środków ochrony roślin, aby spowolnić odpływ i chronić naturalną retencję.",
        "water_gain_mm": 25.0,
        "drought_buffer_days": 7,
        "ecoscheme_name": "Norma GAEC 2 / GAEC 8 (ochrona mokradeł i oczek wodnych) + strefy buforowe",
        "ecoscheme_code": "GAEC_2_8",
        "ecoscheme_pln_per_ha": None,
    },
    "WINDBREAK_SHELTERBELT": {
        "title": "Zakładanie zadrzewień śródpolnych i pasów wiatrochronnych",
        "badge": "Retencja krajobrazowa (Priorytet 3)",
        "why": "W promieniu 300 m od działki nie wykryto zadrzewień śródpolnych ani żywopłotów, co przy deficycie wody (KBW 30d: {kbw_30d:.1f} mm) zwiększa prędkość wiatru nad łanem ({crop}) i przyspiesza parowanie z gleby.",
        "action": "Wzdłuż miedz i dróg dojazdowych (prostopadle do dominujących wiatrów zachodnich) załóż pasy krzewów i drzew rodzimych. Zadrzewienia śródpolne ograniczają parowanie terenowe o 15–25% i zatrzymują śnieg zimą.",
        "water_gain_mm": 18.0,
        "drought_buffer_days": 5,
        "ecoscheme_name": "Interwencja PS WPR: Zakładanie zadrzewień śródpolnych i systemów rolno-leśnych (ARiMR)",
        "ecoscheme_code": "I.10.10 / I.10.11",
        "ecoscheme_pln_per_ha": 1100,
    }
}

def generate_retention_actions(active_rules: List[Dict[str, Any]]) -> List[RetentionAction]:
    """
    Mapuje wyzwolone reguły na ustrukturyzowane karty zaleceń z informacją o zysku retencyjnym i dopłatach ARiMR.
    """
    actions = []
    for item in active_rules:
        rule_id = item["rule_id"]
        priority = item["priority"]
        category = item["category"]
        params = item.get("params", {})

        template = EXPERT_TEMPLATES.get(rule_id)
        if not template:
            continue

        ecoscheme_name = template.get("ecoscheme_name")
        ecoscheme_code = template.get("ecoscheme_code")
        ecoscheme_pln_per_ha = template.get("ecoscheme_pln_per_ha")

        try:
            if rule_id == "RETENTION_DITCH_WEIR":
                slope_val = params.get("slope")
                dist_val = params.get("dist_m", 0)
                crop_val = params.get("crop", "uprawy")
                if str(crop_val).lower().strip() == "laka":
                    ecoscheme_name = "Ekoschemat: Retencjonowanie wody na trwałych użytkach zielonych (TUZ)"
                    ecoscheme_code = "E_RET"
                    ecoscheme_pln_per_ha = 260
                if slope_val is None:
                    why_text = (
                        f"Działka znajduje się zaledwie {dist_val} m od rowu melioracyjnego. "
                        f"Zastawka spowolni odpływ i umożliwi podsiąkowe zatrzymanie wody dla uprawy {crop_val}."
                    )
                elif slope_val < 3.0:
                    why_text = (
                        f"Działka znajduje się zaledwie {dist_val} m od rowu melioracyjnego przy niewielkim spadku "
                        f"terenu ({slope_val:.1f}%), co stwarza bardzo dobre warunki do piętrzenia wody zastawką "
                        f"i zasilania podsiąkowego strefy korzeniowej uprawy {crop_val}."
                    )
                else:
                    why_text = template["why"].format(**params)
            else:
                why_text = template["why"].format(**params)
            action_text = template["action"].format(**params)
        except Exception:
            why_text = template["why"]
            action_text = template["action"]

        actions.append(RetentionAction(
            id=rule_id,
            title=template["title"],
            badge=template["badge"],
            why=why_text,
            action=action_text,
            priority=priority,
            category=category,
            water_gain_mm=template.get("water_gain_mm"),
            drought_buffer_days=template.get("drought_buffer_days"),
            ecoscheme_name=ecoscheme_name,
            ecoscheme_code=ecoscheme_code,
            ecoscheme_pln_per_ha=ecoscheme_pln_per_ha
        ))

    return actions

def generate_irrigation_recommendation(
    irrigation_needed: bool,
    deficit_mm: float,
    awc_mm: float,
    soil_category: str,
    crop_name: str,
    forecast_7d_precip_mm: float = 0.0,
    wind_max_ms: float = 0.0,
    is_archive: bool = False,
) -> IrrigationRecommendation:
    """
    Generuje opcjonalne, interwencyjne zalecenie nawadniania z uwzględnieniem okna pogodowego (prognoza deszczu i wiatru).
    Dla dat archiwalnych (`is_archive=True`) nie wykorzystuje opadów/wiatru z dni po badanej dacie.
    """
    if not irrigation_needed or deficit_mm <= 0:
        return IrrigationRecommendation(
            needed=False,
            status="Nawadnianie nie jest obecnie konieczne",
            dose_mm=0.0,
            dose_m3_per_ha=0.0,
            recommended_timing="Brak wskazań",
            recommended_technique="Retencja naturalna wystarczająca",
            justification=f"Bilans wodny gleby jest stabilny lub niedobór mieści się w granicach tolerancji roślin {crop_name}.",
            forecast_7d_precip_mm=None if is_archive else round(forecast_7d_precip_mm, 1),
            weather_window_status="ARCHIWALNA" if is_archive else "OPTYMALNE"
        )

    if soil_category in ["bardzo lekka", "lekka"]:
        technique = "Linie kroplujące podkorzeniowe lub mikrozraszacze niskociśnieniowe"
        timing = "Wyłącznie godziny wczesnoporanne (4:00 - 7:00) lub nocne, aby uniknąć parowania"
    else:
        technique = "Deszczownia szpulowa z belką zraszającą lub rampa niskociśnieniowa"
        timing = "Późne popołudnie lub noc (po godzinie 20:00)"

    final_needed = True
    final_dose_mm = round(deficit_mm, 1)

    if is_archive:
        status = "Zalecane interwencyjne nawodnienie ratunkowe (stan na dzień badania)"
        weather_window_status = "ARCHIWALNA"
        justification = (
            f"Zalecana dawka interwencyjna {final_dose_mm:.1f} mm ({round(final_dose_mm * 10.0, 1):.0f} m³/ha) "
            f"uzupełnia wyczerpaną retencję glebową (AWC: {awc_mm:.1f} mm). "
            f"Analiza dotyczy daty historycznej — okno prognostyczne nie wpływa na rekomendację."
        )
    elif forecast_7d_precip_mm >= 15.0:
        weather_window_status = "WSTRZYMAJ_OPADY"
        if forecast_7d_precip_mm >= deficit_mm:
            final_needed = False
            final_dose_mm = 0.0
            status = "Zalecane wstrzymanie nawadniania — prognozowany deszcz pokrywa deficyt"
            justification = (
                f"W oknie 7-dniowym prognozowane są opady deszczu w wysokości {forecast_7d_precip_mm:.1f} mm, "
                f"które pokrywają wyliczony deficyt ({deficit_mm:.1f} mm) dla uprawy {crop_name}. "
                f"Wstrzymaj zabieg, aby uniknąć zbędnych kosztów i wymywania składników odżywczych."
            )
        else:
            final_dose_mm = max(0.0, round(deficit_mm - forecast_7d_precip_mm * 0.7, 1))
            status = "Zalecane wstrzymanie lub obniżenie dawki nawadniania — prognozowany deszcz"
            justification = (
                f"W oknie 7-dniowym prognozowane są opady {forecast_7d_precip_mm:.1f} mm. "
                f"Zredukowano zalecaną dawkę z {deficit_mm:.1f} mm do {final_dose_mm:.1f} mm "
                f"({round(final_dose_mm * 10.0, 1):.0f} m³/ha) — wstrzymaj zabieg do czasu weryfikacji opadu."
            )
    elif wind_max_ms > 5.0:
        status = "Zalecane interwencyjne nawodnienie ratunkowe (Uwaga na wiatr)"
        weather_window_status = "OSTRZEZENIE_WIATR"
        timing = (
            f"Wyłącznie godziny bezwietrzne (noc / wczesny poranek) lub nawadnianie kroplowe — "
            f"prognozowane porywy do {wind_max_ms:.1f} m/s powodują duże straty parowania i znoszenie kropel."
        )
        justification = (
            f"Zalecana dawka interwencyjna {final_dose_mm:.1f} mm ({round(final_dose_mm * 10.0, 1):.0f} m³/ha) "
            f"uzupełnia wyczerpaną retencję glebową (AWC: {awc_mm:.1f} mm)."
        )
    else:
        status = "Zalecane interwencyjne nawodnienie ratunkowe"
        weather_window_status = "OPTYMALNE"
        justification = (
            f"Zalecana dawka interwencyjna {final_dose_mm:.1f} mm ({round(final_dose_mm * 10.0, 1):.0f} m³/ha) "
            f"uzupełnia wyczerpaną retencję glebową (AWC: {awc_mm:.1f} mm) bez ryzyka przesiąkania w głąb profilu."
        )

    dose_m3_per_ha = round(final_dose_mm * 10.0, 1)

    return IrrigationRecommendation(
        needed=final_needed,
        status=status,
        dose_mm=final_dose_mm,
        dose_m3_per_ha=dose_m3_per_ha,
        recommended_timing=timing if final_needed else "Wstrzymaj do weryfikacji prognozowanego opadu",
        recommended_technique=technique,
        justification=justification,
        forecast_7d_precip_mm=None if is_archive else round(forecast_7d_precip_mm, 1),
        weather_window_status=weather_window_status
    )

