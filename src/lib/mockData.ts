import {
  AnalyzeRequest,
  AnalysisResponse,
  CropType,
  ParcelSearchResponse,
} from "@/types/analysis";

export interface CropOption {
  id: CropType;
  label: string;
  criticalPhase: string;
  waterDemand: "Niskie" | "Średnie" | "Wysokie";
}

export const CROP_OPTIONS: CropOption[] = [
  {
    id: "pszenica_ozima",
    label: "Pszenica ozima",
    criticalPhase: "Strzelanie w źdźbło, kłoszenie i nalewanie ziarna (V–VI)",
    waterDemand: "Średnie",
  },
  {
    id: "pszenica_jara",
    label: "Pszenica jara",
    criticalPhase: "Krzewienie i kłoszenie – wysoka wrażliwość wiosenna",
    waterDemand: "Wysokie",
  },
  {
    id: "kukurydza",
    label: "Kukurydza",
    criticalPhase: "Wyrzucanie wiech, kwitnienie i zawiązywanie kolb (VII–VIII)",
    waterDemand: "Wysokie",
  },
  {
    id: "rzepak",
    label: "Rzepak",
    criticalPhase: "Kwitnienie oraz zawiązywanie i wypełnianie łuszczyn (V–VI)",
    waterDemand: "Średnie",
  },
  {
    id: "ziemniak",
    label: "Ziemniak",
    criticalPhase: "Zawiązywanie i intensywny przyrost bulw (VI–VIII)",
    waterDemand: "Wysokie",
  },
  {
    id: "burak_cukrowy",
    label: "Burak cukrowy",
    criticalPhase: "Intensywny przyrost masy korzenia spichrzowego (VII–VIII)",
    waterDemand: "Wysokie",
  },
  {
    id: "jeczmien",
    label: "Jęczmień",
    criticalPhase: "Strzelanie w źdźbło i kłoszenie (V–VI)",
    waterDemand: "Niskie",
  },
  {
    id: "laki",
    label: "Łąki i pastwiska",
    criticalPhase: "Odrost runi po kolejnych pokosach w sezonie wegetacyjnym",
    waterDemand: "Wysokie",
  },
  {
    id: "warzywa",
    label: "Warzywa gruntowe",
    criticalPhase: "Cały okres wzrostu – płytki system korzeniowy",
    waterDemand: "Wysokie",
  },
];

export const DEFAULT_SAMPLE_TERYT = "141201_1.0001.123/4";

export const MOCK_PARCELS: Record<string, ParcelSearchResponse> = {
  "141201_1.0001.123/4": {
    teryt: "141201_1.0001.123/4",
    voivodeship: "mazowieckie",
    county: "miński",
    commune: "Mińsk Mazowiecki",
    precinct: "Nowa Wieś",
    area_ha: 4.52,
    center: [52.1812, 21.5643],
    geometry: {
      type: "Feature",
      properties: { teryt: "141201_1.0001.123/4" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [21.5631, 52.1805],
            [21.5655, 52.1805],
            [21.5655, 52.182],
            [21.5631, 52.182],
            [21.5631, 52.1805],
          ],
        ],
      },
    },
  },
  "301704_5.0012.88/2": {
    teryt: "301704_5.0012.88/2",
    voivodeship: "wielkopolskie",
    county: "ostrowski",
    commune: "Ostrów Wielkopolski",
    precinct: "Franklinów",
    area_ha: 11.84,
    center: [51.6942, 17.8125],
    geometry: {
      type: "Feature",
      properties: { teryt: "301704_5.0012.88/2" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [17.8098, 51.693],
            [17.8154, 51.6932],
            [17.8151, 51.6955],
            [17.8095, 51.6952],
            [17.8098, 51.693],
          ],
        ],
      },
    },
  },
  "060903_2.0004.415": {
    teryt: "060903_2.0004.415",
    voivodeship: "lubelskie",
    county: "lubelski",
    commune: "Garbów",
    precinct: "Przybysławice",
    area_ha: 6.3,
    center: [51.3485, 22.339],
    geometry: {
      type: "Feature",
      properties: { teryt: "060903_2.0004.415" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [22.337, 51.3474],
            [22.3412, 51.3476],
            [22.3409, 51.3496],
            [22.3368, 51.3493],
            [22.337, 51.3474],
          ],
        ],
      },
    },
  },
};

export const MOCK_ANALYSIS_BASE: AnalysisResponse = {
  metadata: {
    parcel_id: "141201_1.0001.123/4",
    area_ha: 4.52,
    crop: "Kukurydza",
    analysis_date: "2026-07-15",
    processing_time_sec: 11.4,
    data_sources: [
      {
        name: "Sentinel-2 L2A (AWS STAC)",
        date: "2026-07-12",
        details: "Zachmurzenie: 4.2%",
      },
      {
        name: "Open-Meteo Archive",
        date: "2026-07-15",
        details: "Dane 10-letnie (2016-2026)",
      },
      {
        name: "ISRIC SoilGrids",
        date: "2026-07-15",
        details: "Rozdzielczość 250m",
      },
      {
        name: "Geoportal NMT / OSM Hydro",
        date: "2026-07-15",
        details: "Bufor 300m",
      },
    ],
    limitations: [
      "Brak pomiarów lokalnego poziomu wód gruntowych.",
      "Dane glebowe uśrednione dla siatki 250x250m.",
    ],
  },
  step_1_water_assessment: {
    drought_risk_level: "HIGH",
    climatic_water_balance_mm: -124.5,
    precipitation_30d_mm: 22.0,
    evapotranspiration_30d_mm: 146.5,
    ndvi_current: 0.62,
    ndvi_10y_median: 0.78,
    ndmi_current: 0.11,
    ndmi_10y_median: 0.29,
    soil_retention_capacity: "LOW",
    slope_percent: 4.8,
    nearby_waterways_count: 2,
    identified_causes: [
      "Długotrwały deficyt opadów (35% normy z 10 lat) przy wysokich temperaturach.",
      "Gleba piaszczysta o niskiej zdolności magazynowania wody.",
      "Zwiększony spływ powierzchniowy (nachylenie 4.8%) w kierunku pobliskiego rowu.",
    ],
  },
  step_2_retention_recommendations: [
    {
      category: "Retencja glebowa",
      title:
        "Zastosowanie międzyplonów ścierniskowych i pozostawienie resztek pożniwnych",
      justification:
        "Niska pojemność wodna gleby wymaga ograniczenia parowania i odbudowy próchnicy.",
    },
    {
      category: "Retencja krajobrazowa",
      title: "Spowolnienie odpływu na rowie melioracyjnym (zastawka)",
      justification:
        "W odległości poniżej 300 m od działki wykryto rowy odprowadzające wodę ze stoku.",
    },
  ],
  step_3_irrigation_recommendations: {
    is_recommended: true,
    recommended_dose_mm: 25,
    timing:
      "W ciągu najbliższych 48 godzin (w godzinach wieczornych lub nocnych)",
    justification:
      "Krytyczny niedobór wody (KBW -124.5 mm) w wrażliwej fazie wzrostu uprawy.",
  },
  farmer_friendly_summary:
    "Na Twojej działce występuje wysokie ryzyko suszy rolniczej. W ciągu ostatnich 30 dni z pola wyparowało ponad 6 razy więcej wody (146,5 mm), niż spadło z deszczem (22,0 mm). Lekka, przepuszczalna gleba oraz nachylenie terenu (4,8%) przyspieszają ucieczkę wody do pobliskich rowów. Kondycja roślin na zdjęciach satelitarnych jest o 21% słabsza niż zazwyczaj o tej porze roku. Priorytetem jest zatrzymanie wody w glebie i w rowach melioracyjnych, a doraźnie – pilne nawodnienie ratunkowe.",
};

export function getMockParcelByTeryt(teryt: string): ParcelSearchResponse | null {
  const normalized = teryt.trim();
  if (!normalized) return null;

  if (
    normalized.includes("404") ||
    normalized.toLowerCase().includes("brak") ||
    !/^\d{6}_\d\.\d{4}\.[\d/]+$/.test(normalized)
  ) {
    return null;
  }

  if (MOCK_PARCELS[normalized]) {
    return MOCK_PARCELS[normalized];
  }

  return {
    teryt: normalized,
    voivodeship: "mazowieckie",
    county: "miński",
    commune: "Mińsk Mazowiecki",
    precinct: "Obręb " + normalized.split(".")[1],
    area_ha: 5.4,
    center: [52.1812, 21.5643],
    geometry: {
      type: "Feature",
      properties: { teryt: normalized },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [21.5628, 52.1802],
            [21.5658, 52.1804],
            [21.5654, 52.1822],
            [21.5626, 52.1819],
            [21.5628, 52.1802],
          ],
        ],
      },
    },
  };
}

export function getMockAnalysis(
  request: AnalyzeRequest,
  parcel?: ParcelSearchResponse | null
): AnalysisResponse {
  const cropOption = CROP_OPTIONS.find((c) => c.id === request.crop_type);
  const cropLabel = cropOption ? cropOption.label : "Kukurydza";
  const areaHa = parcel?.area_ha ?? 4.52;

  if (request.teryt.trim() === "060903_2.0004.415") {
    return {
      metadata: {
        parcel_id: request.teryt,
        area_ha: areaHa,
        crop: cropLabel,
        analysis_date: request.analysis_date,
        processing_time_sec: 9.8,
        data_sources: [
          {
            name: "Sentinel-2 L2A (AWS STAC)",
            date: request.analysis_date,
            details: "Zachmurzenie: 2.1%",
          },
          {
            name: "Open-Meteo Archive",
            date: request.analysis_date,
            details: "Dane 10-letnie (2016-2026)",
          },
          {
            name: "ISRIC SoilGrids",
            date: request.analysis_date,
            details: "Rozdzielczość 250m",
          },
          {
            name: "Geoportal NMT / OSM Hydro",
            date: request.analysis_date,
            details: "Bufor 300m",
          },
        ],
        limitations: [
          "Brak pomiarów lokalnego poziomu wód gruntowych.",
          "Dane glebowe uśrednione dla siatki 250x250m.",
        ],
      },
      step_1_water_assessment: {
        drought_risk_level: "MEDIUM",
        climatic_water_balance_mm: -48.0,
        precipitation_30d_mm: 54.0,
        evapotranspiration_30d_mm: 102.0,
        ndvi_current: 0.71,
        ndvi_10y_median: 0.75,
        ndmi_current: 0.24,
        ndmi_10y_median: 0.28,
        soil_retention_capacity: "HIGH",
        slope_percent: 2.1,
        nearby_waterways_count: 1,
        identified_causes: [
          "Umiarkowany niedobór opadów w ostatnich 30 dniach (-48 mm w bilansie wodnym).",
          "Dobra pojemność wodna gleby (gleby pyłowo-lessowe) chroni uprawę przed gwałtownym stresem wodnym.",
        ],
      },
      step_2_retention_recommendations: [
        {
          category: "Agrotechnika oszczędzająca wodę",
          title:
            "Ograniczenie głębokiego wzruszania gleby i utrzymanie mulczu na powierzchni",
          justification:
            "Gleba dobrze magazynuje wilgoć z głębszych warstw – kluczowe jest odcięcie parowania z powierzchni pola.",
        },
        {
          category: "Retencja glebowa",
          title:
            "Wprowadzenie międzyplonów z roślinami bobowatymi po zbiorze plonu głównego",
          justification:
            "Poprawa struktury gruzełkowatej gleby zwiększy infiltrację deszczów nawalnych.",
        },
      ],
      step_3_irrigation_recommendations: {
        is_recommended: false,
        recommended_dose_mm: 0,
        timing: "Brak konieczności interwencyjnego nawadniania w tym tygodniu",
        justification:
          "Zapas wody w strefie korzeniowej jest wystarczający dzięki wysokiej retencji glebowej (NDMI bliskie normy wieloletniej).",
      },
      farmer_friendly_summary: `Na działce ${request.teryt} występuje umiarkowane ryzyko niedoboru wody dla uprawy: ${cropLabel}. Mimo że parowanie przewyższyło opady o 48 mm, żyzna gleba o wysokiej pojemności wodnej utrzymała wilgoć z wcześniejszych tygodni, a kondycja roślin jest bliska normy 10-letniej. Zastosuj zalecenia agrotechniczne chroniące wilgoć w glebie – dodatkowe nawadnianie nie jest obecnie konieczne.`,
    };
  }

  return {
    ...MOCK_ANALYSIS_BASE,
    metadata: {
      ...MOCK_ANALYSIS_BASE.metadata,
      parcel_id: request.teryt,
      area_ha: areaHa,
      crop: cropLabel,
      analysis_date: request.analysis_date,
      data_sources: [
        {
          name: "Sentinel-2 L2A (AWS STAC)",
          date:
            request.analysis_date === "2026-07-15"
              ? "2026-07-12"
              : request.analysis_date,
          details: "Zachmurzenie: 4.2%",
        },
        {
          name: "Open-Meteo Archive",
          date: request.analysis_date,
          details: "Dane 10-letnie (2016-2026)",
        },
        {
          name: "ISRIC SoilGrids",
          date: request.analysis_date,
          details: "Rozdzielczość 250m",
        },
        {
          name: "Geoportal NMT / OSM Hydro",
          date: request.analysis_date,
          details: "Bufor 300m",
        },
      ],
    },
  };
}
