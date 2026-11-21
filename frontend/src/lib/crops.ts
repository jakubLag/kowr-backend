import { CropInfo, CropType } from "@/types/analysis";

export interface CropOption extends CropInfo {
  id: CropType;
  criticalPhase: string;
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
  },
];

export function calculateCropKcForMonth(crop: CropInfo, month: number): number {
  if (month <= 4) {
    return crop.kc_initial;
  }
  if (month === 5 || month === 6) {
    return Number(((crop.kc_initial + crop.kc_mid) / 2.0).toFixed(2));
  }
  if (month === 7 || month === 8) {
    return crop.kc_mid;
  }
  return crop.kc_end;
}

export function getMonthGrowthStageDescription(month: number): string {
  if (month <= 3) {
    return "Okres zimowo-wiosenny (spoczynek lub początek ruszenia wegetacji — niskie parowanie łanu)";
  }
  if (month === 4) {
    return "Faza początkowa wegetacji (wschody i budowa rozety/krzewienie)";
  }
  if (month === 5 || month === 6) {
    return "Faza intensywnego wzrostu wegetatywnego (szybki przyrost biomasy i poboru wody)";
  }
  if (month === 7 || month === 8) {
    return "Faza szczytowego zapotrzebowania wodnego (kwitnienie, zawiązywanie i nalewanie plonu)";
  }
  if (month === 9 || month === 10) {
    return "Faza końcowa / dojrzewanie i zbiory (spadek zapotrzebowania wodnego roślin)";
  }
  return "Okres jesienno-zimowy po zbiorach (retencja pozimowa i odbudowa zapasu wilgoci w glebie)";
}
