"""
Skrypt do weryfikacji i testowania połączenia przez proxy Webshare.
Uruchomienie:
    cd backend
    ../.venv/bin/python test_proxy.py
"""

import os
import sys
import asyncio
import httpx
from app.core.config import settings

async def main():
    print("=" * 65)
    print(" 🌐 TEST POŁĄCZENIA I PROXY (WEBSHARE / HTTP PROXY)")
    print("=" * 65)

    proxy_env = os.environ.get("HTTP_PROXY") or os.environ.get("HTTPS_PROXY")
    print(f"Ustawione proxy w środowisku / .env:")
    if proxy_env:
        # Maskowanie hasła dla bezpieczeństwa
        if "@" in proxy_env:
            schema_user, host_port = proxy_env.split("@", 1)
            schema = schema_user.split("://")[0]
            print(f"  • URL: {schema}://***:***@{host_port}")
        else:
            print(f"  • URL: {proxy_env}")
    else:
        print("  • BRAK PROXY (połączenie bezpośrednie z Twojego IP)")
        print("    -> Aby dodać Webshare, dodaj do pliku backend/.env:")
        print('       HTTP_PROXY="http://USERNAME-rotate:PASSWORD@p.webshare.io:80"')
        print('       HTTPS_PROXY="http://USERNAME-rotate:PASSWORD@p.webshare.io:80"')

    print(f"Reguły NO_PROXY (omijanie proxy dla polskich urzędów):")
    print(f"  • {os.environ.get('NO_PROXY', 'Brak')}")
    print("-" * 65)

    # 1. Sprawdzenie zewnętrznego adresu IP
    print("\n[1/3] Sprawdzanie widocznego adresu IP na zewnątrz...")
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get("https://api.ipify.org?format=json")
            if resp.status_code == 200:
                ip = resp.json().get("ip")
                print(f"  ✅ Twój zewnętrzny adres IP: \033[1;32m{ip}\033[0m")
            else:
                print(f"  ⚠️ Odpowiedź serwera: {resp.status_code}")
    except Exception as e:
        print(f"  ❌ Błąd połączenia z ipify: {e}")

    # 2. Test Open-Meteo API
    print("\n[2/3] Test zapytania do Open-Meteo API (omijanie blokady/timeoutu)...")
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={"latitude": 52.23, "longitude": 21.01, "current_weather": "true"}
            )
            if resp.status_code == 200:
                temp = resp.json().get("current_weather", {}).get("temperature")
                print(f"  ✅ Open-Meteo działa! Temperatura w Warszawie: {temp} °C")
            else:
                print(f"  ⚠️ Open-Meteo zwróciło status: {resp.status_code}")
    except Exception as e:
        print(f"  ❌ Błąd Open-Meteo: {e}")

    # 3. Test Overpass API (OSM)
    print("\n[3/3] Test zapytania do OpenStreetMap Overpass API...")
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get("https://overpass-api.de/api/status")
            if resp.status_code == 200:
                first_line = resp.text.splitlines()[0] if resp.text else "OK"
                print(f"  ✅ Overpass API status: {first_line}")
            else:
                print(f"  ⚠️ Overpass status: {resp.status_code}")
    except Exception as e:
        print(f"  ❌ Błąd Overpass: {e}")

    print("\n" + "=" * 65)
    print(" Gotowe!")
    print("=" * 65)

if __name__ == "__main__":
    asyncio.run(main())
