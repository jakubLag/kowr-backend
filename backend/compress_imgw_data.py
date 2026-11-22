import os
import json

# Wykrywanie pliku źródłowego
input_file = "imgw_stations.json" if os.path.exists("imgw_stations.json") else os.path.join("app", "data", "imgw_stations.json")

print(f"Wczytywanie stacji z: {input_file}...")
with open(input_file, "r", encoding="utf-8") as f:
    data = json.load(f)

slim_stations = []
for station in data:
    lat = float(station["lat"]) if station.get("lat") else None
    lon = float(station["lon"]) if station.get("lon") else None
    if not lat or not lon:
        continue

    # Zachowujemy kluczowe pola potrzebne dla algorytmów KOWR
    slim_station = {
        "id_stacji": station.get("id_stacji"),
        "stacja": station.get("stacja"),
        "rzeka": station.get("rzeka"),
        "lat": lat,
        "lon": lon,
        "stan_wody": int(station["stan_wody"]) if station.get("stan_wody") and str(station["stan_wody"]).isdigit() else None,
    }
    slim_stations.append(slim_station)

# Zapisujemy skompresowany plik do lokalizacji używanej przez backend
output_file = os.path.join("app", "data", "imgw_stations.json")
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(slim_stations, f, ensure_ascii=False)

# Dodatkowo zapisujemy kopię pod nazwą imgw_data_slim.json w katalogu backend
with open("imgw_data_slim.json", "w", encoding="utf-8") as f:
    json.dump(slim_stations, f, indent=2, ensure_ascii=False)

print(f"✅ Sukces! Skompresowano {len(slim_stations)} stacji.")
print(f"   Nowy rozmiar w app/data/imgw_stations.json: {os.path.getsize(output_file) / 1024:.1f} KB (zamiast ~550 KB)")
print(f"   Zapisano także kopię: imgw_data_slim.json ({os.path.getsize('imgw_data_slim.json') / 1024:.1f} KB)")
