"use client";

import React from "react";
import { Diagnosis, RetentionAction } from "@/types/analysis";

interface Step2RetentionProps {
  recommendations: RetentionAction[];
  diagnosis?: Diagnosis;
}

export default function Step2Retention({
  recommendations,
  diagnosis,
}: Step2RetentionProps) {
  const isWaterlogged =
    diagnosis != null &&
    (diagnosis.drought_risk_level.toUpperCase().includes("NADMIAR") ||
      diagnosis.kbw_30d_mm > Math.max(35, diagnosis.awc_mm * 0.85) ||
      diagnosis.kbw_60d_mm > Math.max(60, diagnosis.awc_mm * 1.4));

  const adaptedRecommendations: RetentionAction[] = React.useMemo(() => {
    if (!isWaterlogged || !diagnosis) return recommendations;

    // Jeśli backend przysłał już nowe reguły drenażowe, używamy ich bezpośrednio
    if (
      recommendations.some(
        (r) =>
          r.id === "DRAINAGE_DITCH_OPEN_WEIR" ||
          r.id === "SOIL_WATERLOGGING_SUBSOILING"
      )
    ) {
      return recommendations;
    }

    const list: RetentionAction[] = [];
    if (
      diagnosis.distance_to_ditch_m != null &&
      diagnosis.distance_to_ditch_m <= 300
    ) {
      list.push({
        id: "DRAINAGE_DITCH_OPEN_WEIR",
        title:
          "Regulacja odpływu na rowie melioracyjnym (odprowadzenie nadmiaru wody zastoiskowej)",
        badge: "Melioracja dwukierunkowa (Priorytet 1)",
        why: `Na działce występuje znaczna nadwyżka wody (KBW 30d: +${diagnosis.kbw_30d_mm.toFixed(1)} mm) przekraczająca pojemność gleby (AWC: ${diagnosis.awc_mm.toFixed(1)} mm), a w odległości ${Math.round(diagnosis.distance_to_ditch_m)} m znajduje się rów melioracyjny.`,
        action:
          "Otwórz zastawkę piętrzącą i udrożnij przepusty na rowie melioracyjnym do czasu zejścia wody zastoiskowej, a po ustabilizowaniu wilgotności ponownie zamknij zastawkę, aby zachować rezerwę na okres wiosenno-letni.",
        priority: 1,
        category: "landscape",
      });
    }

    list.push({
      id: "SOIL_WATERLOGGING_SUBSOILING",
      title:
        "Głęboszowanie przełamujące podeszwę płużną i ochrona mokrej gleby przed ugniataniem",
      badge: "Napowietrzenie profilu glebowego (Priorytet 1)",
      why: `Nadmiar opadów (+${diagnosis.kbw_30d_mm.toFixed(1)} mm) wypełnił pory powietrzne w warstwie ornej (AWC: ${diagnosis.awc_mm.toFixed(1)} mm), co grozi niedotlenieniem i gniciem korzeni.`,
      action:
        "Wstrzymaj wjazd ciężkim sprzętem na przelaną glebę (aby nie zniszczyć jej struktury), a po obeschnięciu wykonaj głęboszowanie (35–45 cm) ułatwiające przesiąkanie nadmiaru wody do głębszych warstw.",
      priority: 1,
      category: "soil",
    });

    for (const rec of recommendations) {
      if (rec.id !== "RETENTION_DITCH_WEIR") {
        list.push(rec);
      }
    }
    return list;
  }, [isWaterlogged, diagnosis, recommendations]);
  return (
    <section className="pt-8 border-t-2 border-gov-navy space-y-6 print:break-inside-avoid">
      <div>
        <p className="text-xs font-bold text-gov-success mb-1">
          Etap 2 z 3 — Priorytet przed nawadnianiem
        </p>
        <h2 className="text-xl sm:text-2xl font-bold text-gov-navy">
          2. Rekomendacje retencyjne i agrotechniczne
        </h2>
      </div>

      <div className="gov-callout-success">
        <div className="text-sm font-bold text-gov-navy">
          Zasada priorytetu retencji (KOWR): Zatrzymaj wodę tam, gdzie spadnie
        </div>
        <p className="text-sm text-gov-text mt-1 leading-relaxed">
          Zanim zastosujesz nawadnianie, wdróż zabiegi zatrzymujące wodę opadową
          w glebie i spowalniające jej odpływ z pola. Są to działania o
          najwyższej skuteczności i trwałym efekcie dla gospodarstwa.
        </p>
      </div>

      <div className="border border-gov-border divide-y divide-gov-border bg-white">
        {adaptedRecommendations.map((rec, index) => (
          <div key={rec.id} className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-gov-border">
              <h3 className="text-base sm:text-lg font-bold text-gov-navy">
                {index + 1}. {rec.title}
              </h3>
              <span className="text-xs font-bold text-gov-success bg-gov-success-bg border border-gov-border px-2.5 py-1 rounded-[2px]">
                {rec.badge}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 text-sm">
              <div className="md:col-span-6 space-y-1">
                <div className="text-xs font-bold text-gov-secondary">
                  Dlaczego zalecamy na tej działce (diagnoza)
                </div>
                <p className="text-gov-text leading-relaxed">{rec.why}</p>
              </div>

              <div className="md:col-span-6 md:border-l md:border-gov-border md:pl-5 space-y-1">
                <div className="text-xs font-bold text-gov-navy">
                  Co konkretnie zrobić na polu (działanie)
                </div>
                <p className="text-gov-text font-medium leading-relaxed">
                  {rec.action}
                </p>
              </div>
            </div>

            {(rec.water_gain_mm || rec.ecoscheme_name) && (
              <div className="pt-3 border-t border-gov-border/60 flex flex-wrap items-center gap-3 text-xs">
                {rec.water_gain_mm && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-900 border border-blue-200 rounded font-semibold">
                    💧 Zysk retencji glebowej: +{rec.water_gain_mm} mm
                    {rec.drought_buffer_days && ` (+${rec.drought_buffer_days} dni bufora suszy)`}
                  </span>
                )}
                {rec.ecoscheme_name && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded font-semibold">
                    💰 Dofinansowanie ARiMR: {rec.ecoscheme_name}
                    {rec.ecoscheme_pln_per_ha && ` (${rec.ecoscheme_pln_per_ha} zł/ha)`}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
