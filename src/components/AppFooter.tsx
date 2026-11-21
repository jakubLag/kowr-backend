import React from "react";

export default function AppFooter() {
  return (
    <footer className="bg-gov-surface border-t border-gov-border mt-16 print:hidden">
      <div className="gov-container py-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pb-6 border-b border-gov-border text-xs text-gov-secondary">
          <div className="md:col-span-5 space-y-1.5">
            <div className="font-bold text-gov-navy text-sm">
              Krajowy Ośrodek Wsparcia Rolnictwa (KOWR)
            </div>
            <p className="leading-relaxed">
              Publiczna e-usługa wspomagająca gospodarowanie wodą w rolnictwie.
              System integruje dane satelitarne Sentinel-2, wieloletnie serie
              meteorologiczne oraz mapy glebowe i hydrograficzne.
            </p>
          </div>

          <div className="md:col-span-4 space-y-1.5">
            <div className="font-bold text-gov-text">
              Zasada priorytetu retencji
            </div>
            <p className="leading-relaxed">
              Zgodnie z wytycznymi KOWR aplikacja w pierwszej kolejności
              rekomenduje działania zatrzymujące wodę opadową w glebie i
              krajobrazie, a nawadnianie traktuje jako zabieg uzupełniający.
            </p>
          </div>

          <div className="md:col-span-3 space-y-1.5">
            <div className="font-bold text-gov-text">
              Dostępność i wymagania
            </div>
            <p className="leading-relaxed">
              Serwis działa w przeglądarkach Chrome, Edge i Firefox bez
              konieczności instalacji oprogramowania GIS. Projekt zgodny ze
              standardem WCAG 2.1 AA.
            </p>
          </div>
        </div>

        <div className="pt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-gov-muted">
          <span>Wszystkie dane prezentowane w serwisie mają charakter doradczy</span>
        </div>
      </div>
    </footer>
  );
}
