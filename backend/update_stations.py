"""
Skrypt do pobierania i aktualizowania bazy stacji hydrologicznych IMGW-PIB.
Uruchomienie:
    cd backend
    ../.venv/bin/python update_stations.py
"""

import os
import json
import httpx

IMGW_HYDRO_URL = "https://danepubliczne.imgw.pl/api/data/hydro/"
TARGET_FILE = os.path.join(os.path.dirname(__file__), "app", "data", "imgw_stations.json")

def update_stations():
    print(f"Pobieranie stacji z IMGW: {IMGW_HYDRO_URL}...")
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(IMGW_HYDRO_URL)
            if resp.status_code == 200:
                data = resp.json()
                os.makedirs(os.path.dirname(TARGET_FILE), exist_ok=True)
                with open(TARGET_FILE, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False)
                print(f"✅ Sukces! Zapisano {len(data)} stacji hydrologicznych IMGW do:")
                print(f"   {TARGET_FILE} ({os.path.getsize(TARGET_FILE) / 1024:.1f} KB)")
            else:
                print(f"❌ Serwer IMGW zwrócił kod: {resp.status_code}")
    except Exception as e:
        print(f"❌ Błąd podczas pobierania stacji: {e}")

if __name__ == "__main__":
    update_stations()
