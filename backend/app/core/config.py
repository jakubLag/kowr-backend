import os
from typing import List, Optional
from pydantic import BaseModel


CLOUD_COVER_MAX: int = 40


def _load_env_file():
    """Wczytuje zmienne środowiskowe z pliku .env w katalogu głównym projektu."""
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    if key not in os.environ:
                        os.environ[key] = val

_load_env_file()

class Settings(BaseModel):
    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "KOWR - Zatrzymaj wodę, chroń plony")
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = os.getenv("API_V1_PREFIX", "/api")
    
    
    # Timeouts (sec) - strict 7s timeout per external service as per specification
    SERVICE_TIMEOUT_SECONDS: float = float(os.getenv("SERVICE_TIMEOUT_SECONDS", "7.0"))
    
    # Copernicus Data Space Ecosystem (CDSE) / Sentinel Hub
    CDSE_CLIENT_ID: Optional[str] = os.getenv("CDSE_CLIENT_ID")
    CDSE_CLIENT_SECRET: Optional[str] = os.getenv("CDSE_CLIENT_SECRET")
    CDSE_TOKEN_URL: str = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
    CDSE_PROCESS_URL: str = "https://sh.dataspace.copernicus.eu/api/v1/process"
    CDSE_CATALOG_URL: str = "https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search"

    # External APIs
    ULDK_BASE_URL: str = "https://uldk.gugik.gov.pl/service.php"
    OPEN_METEO_BASE_URL: str = "https://archive-api.open-meteo.com/v1/archive"
    OPEN_METEO_FORECAST_URL: str = "https://api.open-meteo.com/v1/forecast"
    SOILGRIDS_BASE_URL: str = "https://rest.isric.org/soilgrids/v2.0/properties/query"
    STAC_EARTH_SEARCH_URL: str = "https://earth-search.aws.element84.com/v1"
    GEOPORTAL_NMT_WCS_URL: str = "https://mapy.geoportal.gov.pl/wss/service/PZGIK/NMT/GRID1/WCS/DemService"
    GUGIK_NMT_URL: str = "https://services.gugik.gov.pl/nmt/"
    IMGW_HYDRO_URL: str = "https://danepubliczne.imgw.pl/api/data/hydro/"
    HYDROPORTAL_WMS_URL: str = "https://wody.isok.gov.pl/wss/INSPIRE/INSPIRE_HY_10k_2019_WMS"
    OVERPASS_API_URL: str = "https://overpass-api.de/api/interpreter"


    # CORS origins (zgodne z wytycznymi bezpieczeństwa pkt 5.6)
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "https://145.239.90.237.nip.io",
        "https://kowr-front.vercel.app"
    ]

settings = Settings()

