# Zatrzymaj wodę, chroń plony — Frontend (Next.js 14 + Tailwind CSS + TypeScript)

Moduł frontendowy aplikacji opracowanej na hackathon **HackNation 2026** dla zadania **Krajowego Ośrodka Wsparcia Rolnictwa (KOWR)**.

Pełna dokumentacja projektu (architektura, źródła danych, licencje, ograniczenia, weryfikacja i skalowalność) znajduje się w głównym pliku [README.md](../README.md).

## Uruchomienie lokalne

```bash
cp .env.example .env.local
npm install
npm run dev
```

Aplikacja uruchomi się pod adresem `http://localhost:3000`.

## Konfiguracja połączenia z backendem FastAPI

Adres backendu konfiguruje się zmienną środowiskową `NEXT_PUBLIC_API_URL` w pliku `.env.local` (domyślny fallback w `src/lib/api.ts`: `http://localhost:8000`).

Frontend korzysta bezpośrednio z następujących endpointów backendu:
* `GET /api/parcel/search?teryt=...` — wyszukiwanie działki po identyfikatorze TERYT,
* `GET /api/parcel/by-point?lat=...&lon=...` — wybór działki kliknięciem na mapie,
* `GET /api/crops` — słownik obsługiwanych upraw i parametrów FAO-56,
* `POST /api/analyze` — pełna 3-etapowa analiza agrohydrologiczna działki.

Dodatkowo w `src/app/api/` działają lekkie route handlery Next.js dla mapy:
* `GET /api/geocode` — wyszukiwanie miejscowości (OpenStreetMap Nominatim),
* `GET /api/landuse` — sprawdzenie pokrycia terenu (woda / las / grunt rolny) dla klikniętego punktu.

## Weryfikacja typów i budowa produkcyjna

```bash
npx tsc --noEmit
npm run build
```
