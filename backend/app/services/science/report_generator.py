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

EXPERT_TEMPLATES: Dict[str, Dict[str, str]] = {
    "RETENTION_DITCH_WEIR": {
        "title": "Budowa zastawki szandorowej na rowie melioracyjnym",
        "badge": "Retencja krajobrazowa (Priorytet 1)",
        "why": "Działka posiada nachylenie {slope:.1f}% i znajduje się zaledwie {dist_m} m od rowu melioracyjnego. Zastawka spowolni odpływ i podniesie poziom wód gruntowych w strefie korzeniowej {crop}.",
        "action": "Zainstaluj zastawkę szandorową lub próg piętrzący na rowie przed okresem wiosennych roztopów i zamknij odpływ po osiągnięciu bezpiecznego poziomu wody.",
    },
    "SOIL_LOW_AWC_COVER_CROP": {
        "title": "Wprowadzenie międzyplonów i mulczowania",
        "badge": "Retencja glebowa (Priorytet 2)",
        "why": "Gleba w klasie '{soil_category}' posiada niską retencję użyteczną (AWC: {awc:.1f} mm). Woda szybko przesiąka poniżej warstwy korzeniowej {crop}.",
        "action": "Zastosuj siew międzyplonów ścierniskowych (np. facelia, gorczyca, rzodkiew oleista) i pozostaw mulcz na zimę. Każdy 1% materii organicznej zatrzymuje do 150 m³ wody na hektar.",
    },
    "NO_TILL_EVAPORATION_REDUCTION": {
        "title": "Uprawa bezorkowa lub pasowa (Strip-Till)",
        "badge": "Ochrona wilgoci glebowej (Priorytet 2)",
        "why": "Deficyt parowania osiągnął KBW: {kbw_30d:.1f} mm. Tradycyjna orka odkrywkowa powoduje gwałtowną utratę nawet 15-25 mm wody w ciągu pierwszych 48 godzin od zabiegu.",
        "action": "Zastąp tradycyjną orkę płużną głęboszowaniem bezodwracającym lub technologią Strip-Till, pozostawiając resztki pożniwne na powierzchni pola.",
    },
    "CONTOUR_FARMING_SLOPE": {
        "title": "Uprawa w poprzek stoku i pasy zadarnione",
        "badge": "Retencja stokowa i antyerozja (Priorytet 2)",
        "why": "Nachylenie terenu {slope:.1f}% powoduje szybki spływ powierzchniowy wody opadowej, unosząc cenną próchnicę i uniemożliwiając wsiąkanie.",
        "action": "Wykonuj wszelkie zabiegi uprawowe wyłącznie prostopadle do kierunku stoku (wzdłuż warstwic) oraz utwórz pas buforowy z trwałej darni w najniższym punkcie spływu.",
    },
    "MICRO_RETENTION_POND": {
        "title": "Budowa niecki chłonnej lub oczka mikro-retencyjnego",
        "badge": "Mikro-retencja wodna (Priorytet 3)",
        "why": "Powierzchnia {area_ha:.2f} ha generuje znaczną objętość spływu burzowego podczas nawalnych deszczy przy łącznym deficycie 60-dniowym KBW {kbw_60d:.1f} mm.",
        "action": "Utwórz w naturalnym obniżeniu terenu bezodpływową nieckę bioretencyjną lub mały staw śródpolny do 1000 m², co kwalifikuje się do dofinansowania z programów retencyjnych KOWR / ARiMR.",
    },
    "DRAINAGE_DITCH_OPEN_WEIR": {
        "title": "Regulacja odpływu na rowie melioracyjnym (odprowadzenie nadmiaru wody)",
        "badge": "Melioracja dwukierunkowa (Priorytet 1)",
        "why": "Na działce występuje znaczna nadwyżka wody (KBW 30d: +{kbw_30d:.1f} mm), a w odległości {dist_m} m znajduje się rów melioracyjny. Zbyt wysoki poziom wody grozi uduszeniem systemu korzeniowego uprawy ({crop}).",
        "action": "Otwórz zastawkę piętrzącą i udrożnij przepusty na rowie melioracyjnym do czasu odprowadzenia wody zastoiskowej, a po ustabilizowaniu wilgotności ponownie zamknij zastawkę, aby zachować rezerwę na okres letni.",
    },
    "SOIL_WATERLOGGING_SUBSOILING": {
        "title": "Głęboszowanie przełamujące podeszwę płużną i ochrona przed ugniataniem",
        "badge": "Napowietrzenie profilu glebowego (Priorytet 1)",
        "why": "Nadmiar opadów (+{kbw_30d:.1f} mm) przekroczył pojemność wodną warstwy ornej (AWC: {awc:.1f} mm), powodując wypchnięcie powietrza z porów glebowych i powstawanie zastoisk powierzchniowych.",
        "action": "Wstrzymaj wjazd ciężkim sprzętem na przelaną glebę (aby nie zniszczyć jej struktury), a po obeschnięciu wykonaj głęboszowanie (35–45 cm) ułatwiające przesiąkanie nadmiaru wody do głębszych warstw.",
    },
    "WETLAND_POND_PROTECTION": {
        "title": "Ochrona i strefa buforowa przy oczkach wodnych lub mokradłach",
        "badge": "Retencja krajobrazowa (Priorytet 2)",
        "why": "W promieniu 500 m od działki zidentyfikowano naturalne oczka wodne, zbiorniki lub mokradła, które stabilizują lokalny mikroklimat i zasilają wody gruntowe dla uprawy ({crop}).",
        "action": "Nie osuszaj ani nie zasypuj obniżeń z wodą. Utrzymuj 3–5 m zadarnionej strefy buforowej wokół zbiornika/mokradła bez stosowania nawozów i środków ochrony roślin, aby spowolnić odpływ i chronić naturalną retencję.",
    },
    "WINDBREAK_SHELTERBELT": {
        "title": "Zakładanie zadrzewień śródpolnych i pasów wiatrochronnych",
        "badge": "Retencja krajobrazowa (Priorytet 3)",
        "why": "W promieniu 300 m od działki nie wykryto zadrzewień śródpolnych ani żywopłotów, co przy deficycie wody (KBW 30d: {kbw_30d:.1f} mm) zwiększa prędkość wiatru nad łanem ({crop}) i przyspiesza parowanie z gleby.",
        "action": "Wzdłuż miedz i dróg dojazdowych (prostopadle do dominujących wiatrów zachodnich) załóż pasy krzewów i drzew rodzimych. Zadrzewienia śródpolne ograniczają parowanie terenowe o 15–25% i zatrzymują śnieg zimą.",
    }
}

def generate_retention_actions(active_rules: List[Dict[str, Any]]) -> List[RetentionAction]:
    """
    Mapuje wyzwolone reguły na ustrukturyzowane karty zaleceń.
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

        try:
            if rule_id == "RETENTION_DITCH_WEIR":
                slope_val = params.get("slope")
                dist_val = params.get("dist_m", 0)
                crop_val = params.get("crop", "uprawy")
                if slope_val is None:
                    why_text = (
                        f"Działka znajduje się zaledwie {dist_val} m od rowu melioracyjnego. "
                        f"Zastawka spowolni odpływ i umożliwi podsiąkowe zatrzymanie wody dla uprawy {crop_val}."
                    )
                elif slope_val < 3.0:
                    why_text = (
                        f"Nachylenie terenu ({slope_val:.1f}%) jest na tyle małe (< 3%), że rowy nie wpływają negatywnie "
                        f"na nawodnienie. Zastawka na rowie w odległości {dist_val} m umożliwi jednak podsiąkowe "
                        f"zatrzymanie wody dla uprawy {crop_val}."
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
            category=category
        ))

    return actions

def generate_irrigation_recommendation(
    irrigation_needed: bool,
    deficit_mm: float,
    awc_mm: float,
    soil_category: str,
    crop_name: str
) -> IrrigationRecommendation:
    """
    Generuje opcjonalne, ściśle interwencyjne zalecenie nawadniania.
    Zgodnie z zasadą KOWR: nawadnianie jest ostatecznością, priorytetem jest retencja.
    """
    if not irrigation_needed or deficit_mm <= 0:
        return IrrigationRecommendation(
            needed=False,
            status="Nawadnianie nie jest obecnie konieczne",
            dose_mm=0.0,
            dose_m3_per_ha=0.0,
            recommended_timing="Brak wskazań",
            recommended_technique="Retencja naturalna wystarczająca",
            justification=f"Bilans wodny gleby jest stabilny lub niedobór mieści się w granicach tolerancji roślin {crop_name}."
        )

    # 1 mm słupa wody = 10 m³ na hektar
    dose_m3_per_ha = round(deficit_mm * 10.0, 1)

    if soil_category in ["bardzo lekka", "lekka"]:
        technique = "Linie kroplujące podkorzeniowe lub mikrozraszacze niskociśnieniowe"
        timing = "Wyłącznie godziny wczesnoporanne (4:00 - 7:00) lub nocne, aby uniknąć parowania"
    else:
        technique = "Deszczownia szpulowa z belką zraszającą lub rampa niskociśnieniowa"
        timing = "Późne popołudnie lub noc (po godzinie 20:00)"

    justification = (
        f"Zalecana dawka interwencyjna {deficit_mm:.1f} mm ({dose_m3_per_ha:.0f} m³/ha) "
        f"uzupełnia wyczerpaną retencję glebową (AWC: {awc_mm:.1f} mm) bez ryzyka przesiąkania w głąb profilu."
    )

    return IrrigationRecommendation(
        needed=True,
        status="Zalecane interwencyjne nawodnienie ratunkowe",
        dose_mm=deficit_mm,
        dose_m3_per_ha=dose_m3_per_ha,
        recommended_timing=timing,
        recommended_technique=technique,
        justification=justification
    )

