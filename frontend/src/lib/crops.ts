import { CropInfo, CropType } from "@/types/analysis";

export interface CropOption extends CropInfo {
  id: CropType;
  criticalPhase: string;
  kc_by_month: Record<number, number>;
}

export const CROP_OPTIONS: CropOption[] = [
  {
    id: "kukurydza",
    name_pl: "Kukurydza na ziarno / kiszonkę",
    kc_initial: 0.35,
    kc_mid: 1.2,
    kc_end: 0.6,
    root_depth_m: 0.9,
    drought_sensitivity: "WYSOKA",
    criticalPhase: "Kwitnienie i nalewanie ziarna (lipiec–sierpień)",
    kc_by_month: {
      1: 0.25,
      2: 0.25,
      3: 0.25,
      4: 0.3,
      5: 0.45,
      6: 0.85,
      7: 1.2,
      8: 1.2,
      9: 0.85,
      10: 0.5,
      11: 0.25,
      12: 0.25,
    },
  },
  {
    id: "pszenica_ozima",
    name_pl: "Pszenica ozima",
    kc_initial: 0.4,
    kc_mid: 1.15,
    kc_end: 0.3,
    root_depth_m: 1.0,
    drought_sensitivity: "ŚREDNIA",
    criticalPhase: "Strzelanie w źdźbło i kłoszenie (maj–czerwiec)",
    kc_by_month: {
      1: 0.35,
      2: 0.35,
      3: 0.5,
      4: 0.85,
      5: 1.15,
      6: 1.15,
      7: 0.6,
      8: 0.25,
      9: 0.3,
      10: 0.4,
      11: 0.4,
      12: 0.35,
    },
  },
  {
    id: "pszenica_jara",
    name_pl: "Pszenica jara",
    kc_initial: 0.35,
    kc_mid: 1.15,
    kc_end: 0.3,
    root_depth_m: 0.8,
    drought_sensitivity: "WYSOKA",
    criticalPhase: "Kłoszenie i nalewanie ziarna (czerwiec–lipiec)",
    kc_by_month: {
      1: 0.25,
      2: 0.25,
      3: 0.3,
      4: 0.45,
      5: 0.85,
      6: 1.15,
      7: 1.1,
      8: 0.45,
      9: 0.25,
      10: 0.25,
      11: 0.25,
      12: 0.25,
    },
  },
  {
    id: "rzepak",
    name_pl: "Rzepak ozimy",
    kc_initial: 0.35,
    kc_mid: 1.1,
    kc_end: 0.35,
    root_depth_m: 1.2,
    drought_sensitivity: "ŚREDNIA",
    criticalPhase: "Kwitnienie i zawiązywanie łuszczyn (kwiecień–maj)",
    kc_by_month: {
      1: 0.35,
      2: 0.35,
      3: 0.55,
      4: 1.05,
      5: 1.1,
      6: 0.7,
      7: 0.35,
      8: 0.25,
      9: 0.4,
      10: 0.5,
      11: 0.45,
      12: 0.35,
    },
  },
  {
    id: "burak_cukrowy",
    name_pl: "Burak cukrowy",
    kc_initial: 0.35,
    kc_mid: 1.2,
    kc_end: 0.7,
    root_depth_m: 1.0,
    drought_sensitivity: "WYSOKA",
    criticalPhase: "Zwarcie międzyrzędzi i przyrost korzenia (lipiec–sierpień)",
    kc_by_month: {
      1: 0.25,
      2: 0.25,
      3: 0.25,
      4: 0.35,
      5: 0.55,
      6: 0.95,
      7: 1.2,
      8: 1.2,
      9: 0.95,
      10: 0.7,
      11: 0.3,
      12: 0.25,
    },
  },
  {
    id: "ziemniak",
    name_pl: "Ziemniak",
    kc_initial: 0.45,
    kc_mid: 1.15,
    kc_end: 0.75,
    root_depth_m: 0.6,
    drought_sensitivity: "BARDZO WYSOKA",
    criticalPhase: "Zawiązywanie i przyrost bulw (czerwiec–sierpień)",
    kc_by_month: {
      1: 0.25,
      2: 0.25,
      3: 0.25,
      4: 0.4,
      5: 0.65,
      6: 1.05,
      7: 1.15,
      8: 1.1,
      9: 0.7,
      10: 0.3,
      11: 0.25,
      12: 0.25,
    },
  },
  {
    id: "jeczmien",
    name_pl: "Jęczmień",
    kc_initial: 0.3,
    kc_mid: 1.15,
    kc_end: 0.25,
    root_depth_m: 0.8,
    drought_sensitivity: "ŚREDNIA",
    criticalPhase: "Kłoszenie (maj–czerwiec)",
    kc_by_month: {
      1: 0.3,
      2: 0.3,
      3: 0.4,
      4: 0.7,
      5: 1.1,
      6: 1.15,
      7: 0.55,
      8: 0.25,
      9: 0.25,
      10: 0.3,
      11: 0.3,
      12: 0.3,
    },
  },
  {
    id: "zyto",
    name_pl: "Żyto ozime",
    kc_initial: 0.3,
    kc_mid: 1.05,
    kc_end: 0.25,
    root_depth_m: 1.1,
    drought_sensitivity: "NISKA",
    criticalPhase: "Strzelanie w źdźbło (maj)",
    kc_by_month: {
      1: 0.3,
      2: 0.3,
      3: 0.45,
      4: 0.85,
      5: 1.05,
      6: 1.0,
      7: 0.5,
      8: 0.25,
      9: 0.3,
      10: 0.35,
      11: 0.35,
      12: 0.3,
    },
  },
  {
    id: "soja",
    name_pl: "Soja",
    kc_initial: 0.35,
    kc_mid: 1.15,
    kc_end: 0.5,
    root_depth_m: 0.8,
    drought_sensitivity: "WYSOKA",
    criticalPhase: "Kwitnienie i wiązanie strąków (lipiec–sierpień)",
    kc_by_month: {
      1: 0.25,
      2: 0.25,
      3: 0.25,
      4: 0.3,
      5: 0.45,
      6: 0.85,
      7: 1.15,
      8: 1.15,
      9: 0.65,
      10: 0.3,
      11: 0.25,
      12: 0.25,
    },
  },
  {
    id: "laka",
    name_pl: "Trwałe użytki zielone (łąki / pastwiska)",
    kc_initial: 0.6,
    kc_mid: 1.0,
    kc_end: 0.85,
    root_depth_m: 0.5,
    drought_sensitivity: "ŚREDNIA",
    criticalPhase: "Odrost po pokosach (cały sezon wegetacyjny)",
    kc_by_month: {
      1: 0.4,
      2: 0.4,
      3: 0.55,
      4: 0.8,
      5: 1.0,
      6: 1.0,
      7: 0.95,
      8: 0.95,
      9: 0.85,
      10: 0.75,
      11: 0.5,
      12: 0.4,
    },
  },
];

export function calculateCropKcForMonth(crop: CropInfo, month: number): number {
  const m = Math.min(12, Math.max(1, Math.round(month)));
  const matchedOption =
    "kc_by_month" in crop &&
    (crop as CropOption).kc_by_month &&
    typeof (crop as CropOption).kc_by_month[m] === "number"
      ? (crop as CropOption)
      : CROP_OPTIONS.find((c) => c.id === String(crop.id).toLowerCase());

  if (matchedOption && typeof matchedOption.kc_by_month[m] === "number") {
    return matchedOption.kc_by_month[m];
  }

  if (m <= 4) {
    return crop.kc_initial;
  }
  if (m === 5 || m === 6) {
    return Number(((crop.kc_initial + crop.kc_mid) / 2.0).toFixed(2));
  }
  if (m === 7 || m === 8) {
    return crop.kc_mid;
  }
  return crop.kc_end;
}

export function getMonthGrowthStageDescription(
  month: number,
  cropId?: string
): string {
  const m = Math.min(12, Math.max(1, Math.round(month)));
  const id = (cropId || "").toLowerCase();

  // Zboża ozime (pszenica ozima, żyto ozime, jęczmień)
  if (id === "pszenica_ozima" || id === "zyto" || id === "jeczmien") {
    if (m <= 2 || m === 12) {
      return "Spoczynek zimowy ozimin (niskie parowanie łanu, odbudowa retencji zimowej)";
    }
    if (m === 3) {
      return "Ruszenie wegetacji wiosennej i dokrzewianie (rosnące zapotrzebowanie na wodę)";
    }
    if (m === 4) {
      return "Strzelanie w źdźbło (intensywny przyrost biomasy i wzrost poboru wody)";
    }
    if (m === 5 || m === 6) {
      return "Kłoszenie, kwitnienie i nalewanie ziarna (szczytowe zapotrzebowanie wodne)";
    }
    if (m === 7) {
      return "Dojrzewanie i początek żniw (wyraźny spadek zapotrzebowania wodnego)";
    }
    if (m === 8) {
      return "Po żniwach / ściernisko (niskie parowanie łanu, okno na mulczowanie i międzyplon)";
    }
    if (m === 9 || m === 10) {
      return "Siew jesienny, wschody i krzewienie ozimin (umiarkowane zapotrzebowanie na wilgoć w warstwie siewnej)";
    }
    return "Hartowanie jesienne przed zimą (spadek parowania i gromadzenie zapasu wody w glebie)";
  }

  // Rzepak ozimy
  if (id === "rzepak") {
    if (m <= 2 || m === 12) {
      return "Spoczynek zimowy (niskie parowanie, magazynowanie wody pozimowej)";
    }
    if (m === 3) {
      return "Ruszenie wegetacji i wzrost pędu głównego (szybki wzrost zapotrzebowania na wodę)";
    }
    if (m === 4 || m === 5) {
      return "Pąkowanie, kwitnienie i zawiązywanie łuszczyn (szczytowe zapotrzebowanie wodne)";
    }
    if (m === 6) {
      return "Nalewanie nasion i początek dojrzewania (stopniowy spadek poboru wody)";
    }
    if (m === 7) {
      return "Dojrzewanie techniczne i zbiór rzepaku (niskie zapotrzebowanie wodne)";
    }
    if (m === 8) {
      return "Po zbiorach / siew rzepaku ozimego (ściernisko lub wschody nowego zasiewu)";
    }
    if (m === 9 || m === 10) {
      return "Budowa rozety liściowej jesienią (umiarkowany pobór wody z warstwy ornej)";
    }
    return "Wejście w spoczynek zimowy (retencja jesienno-zimowa gleby)";
  }

  // Pszenica jara
  if (id === "pszenica_jara") {
    if (m <= 3) {
      return "Okres przedsiewny / siew wiosenny (kluczowe zachowanie wilgoci pozimowej)";
    }
    if (m === 4) {
      return "Wschody i krzewienie (niskie parowanie łanu, wrażliwość warstwy wierzchniej)";
    }
    if (m === 5) {
      return "Strzelanie w źdźbło (szybki wzrost zapotrzebowania na wodę)";
    }
    if (m === 6 || m === 7) {
      return "Kłoszenie, kwitnienie i nalewanie ziarna (szczytowe zapotrzebowanie wodne)";
    }
    if (m === 8) {
      return "Dojrzewanie i żniwa zbóż jarych (spadek poboru wody)";
    }
    return "Okres pożniwny / ściernisko lub międzyplon (odbudowa retencji glebowej)";
  }

  // Kukurydza i soja (ciepłolubne jare)
  if (id === "kukurydza" || id === "soja") {
    if (m <= 3) {
      return "Okres przedsiewny (pole przed siewem — magazynowanie zapasów wody pozimowej)";
    }
    if (m === 4 || m === 5) {
      return "Siew, wschody i początkowy wzrost liści (niskie pokrycie gleby, ryzyko parowania z odkrytej gleby)";
    }
    if (m === 6) {
      return "Intensywny wzrost wegetatywny i zakrywanie międzyrzędzi (szybki wzrost poboru wody)";
    }
    if (m === 7 || m === 8) {
      return id === "soja"
        ? "Kwitnienie i wiązanie strąków (szczytowe zapotrzebowanie wodne)"
        : "Kwitnienie (wiechowanie) i nalewanie ziarna (szczytowe zapotrzebowanie wodne)";
    }
    if (m === 9) {
      return "Dojrzewanie fizjologiczne (stopniowy spadek poboru wody)";
    }
    if (m === 10) {
      return "Zbiór i okres pożniwny (niskie zapotrzebowanie wodne)";
    }
    return "Okres po zbiorach (retencja jesienno-zimowa i odbudowa wilgoci w glebie)";
  }

  // Burak cukrowy
  if (id === "burak_cukrowy") {
    if (m <= 3) {
      return "Okres przedsiewny (ochrona wilgoci pozimowej przed siewem)";
    }
    if (m === 4 || m === 5) {
      return "Siew, wschody i formowanie rozety (niskie parowanie łanu)";
    }
    if (m === 6) {
      return "Zwarcie międzyrzędzi (dynamiczny wzrost poboru wody)";
    }
    if (m === 7 || m === 8) {
      return "Intensywny przyrost masy korzenia i gromadzenie cukru (szczytowe zapotrzebowanie wodne)";
    }
    if (m === 9 || m === 10) {
      return "Dojrzewanie technologiczne i wykopki (stopniowy spadek parowania)";
    }
    return "Okres po zbiorach (odbudowa zapasów wody w profilu glebowym)";
  }

  // Ziemniak
  if (id === "ziemniak") {
    if (m <= 3) {
      return "Okres przed sadzeniem (magazynowanie wody pozimowej)";
    }
    if (m === 4 || m === 5) {
      return "Sadzenie, wschody i wzrost naci (płytki system korzeniowy — wrażliwość warstwy ornej)";
    }
    if (m === 6 || m === 7 || m === 8) {
      return "Zawiązywanie i intensywny przyrost bulw (szczytowe zapotrzebowanie wodne, bardzo wysoka wrażliwość na suszę)";
    }
    if (m === 9) {
      return "Zasychanie naci i wykopki (spadek zapotrzebowania wodnego)";
    }
    return "Okres po zbiorach (retencja jesienno-zimowa gleby)";
  }

  // Trwałe użytki zielone (TUZ)
  if (id === "laka") {
    if (m <= 2 || m === 12) {
      return "Spoczynek zimowy runi (odbudowa retencji na użytku zielonym)";
    }
    if (m === 3) {
      return "Wczesnowiosenne ruszenie runi łąkowej";
    }
    if (m >= 4 && m <= 8) {
      return "Intensywny wzrost runi i odrost po kolejnych pokosach (wysokie zapotrzebowanie wodne w płytkiej strefie korzeniowej)";
    }
    if (m === 9 || m === 10) {
      return "Jesienny odrost runi i przygotowanie do zimowania";
    }
    return "Zakończenie wegetacji runi (magazynowanie wody jesienno-zimowej)";
  }

  // Domyślny opis dla pozostałych upraw
  if (m <= 3) {
    return "Okres zimowo-wiosenny (spoczynek lub początek ruszenia wegetacji — niskie parowanie łanu)";
  }
  if (m === 4) {
    return "Faza początkowa wegetacji (wschody i budowa rozety/krzewienie)";
  }
  if (m === 5 || m === 6) {
    return "Faza intensywnego wzrostu wegetatywnego (szybki przyrost biomasy i poboru wody)";
  }
  if (m === 7 || m === 8) {
    return "Faza szczytowego zapotrzebowania wodnego (kwitnienie, zawiązywanie i nalewanie plonu)";
  }
  if (m === 9 || m === 10) {
    return "Faza końcowa / dojrzewanie i zbiory (spadek zapotrzebowania wodnego roślin)";
  }
  return "Okres jesienno-zimowy po zbiorach (retencja pozimowa i odbudowa zapasu wilgoci w glebie)";
}
