# Zatrzymaj wodę, chroń plony – Frontend (Next.js + Tailwind CSS + TypeScript)
**HackNation 2026 – Zadanie KOWR:** *„Zatrzymaj wodę, chroń plony – Inteligentne wsparcie gospodarowania wodą w rolnictwie”*

## Uruchomienie projektu

```bash
npm install
npm run dev
```

Aplikacja uruchomi się pod adresem `http://localhost:3000`.

## Integracja z Backendem FastAPI

Domyślny adres API to `http://localhost:8000` (konfigurowalny przez zmienną `NEXT_PUBLIC_API_URL` w pliku `.env.local`).
- Jeśli backend FastAPI jest uruchomiony, aplikacja automatycznie odpytuje `GET /api/parcel/search?teryt=...` oraz `POST /api/analyze`.
- Jeśli backend jest wyłączony (lub w górnym pasku włączono **Tryb: Tylko Mock**), aplikacja automatycznie korzysta z lokalnych danych demonstracyjnych (`src/lib/mockData.ts`) zgodnych w 100% z kontraktem API.
