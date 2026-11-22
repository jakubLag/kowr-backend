import os
from typing import List, Optional
from pydantic import BaseModel


CLOUD_COVER_MAX: int = 30


def _load_env_file():
    """Wczytuje zmienne środowiskowe z plików .env (w katalogu głównym oraz backend/)."""
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    root_dir = os.path.dirname(backend_dir)
    for env_path in (os.path.join(backend_dir, ".env"), os.path.join(root_dir, ".env")):
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

# Synchronizacja proxy dla httpx, requests i urllib
_proxy_val = os.environ.get("HTTP_PROXY") or os.environ.get("HTTPS_PROXY")
if _proxy_val:
    for _k in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "ALL_PROXY", "all_proxy"):
        os.environ[_k] = _proxy_val
    if "NO_PROXY" not in os.environ and "no_proxy" not in os.environ:
        os.environ["NO_PROXY"] = "localhost,127.0.0.1"
        os.environ["no_proxy"] = "localhost,127.0.0.1"

class Settings(BaseModel):
    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "KOWR - Zatrzymaj wodę, chroń plony")
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = os.getenv("API_V1_PREFIX", "/api")
    
    # Proxy sieciowe (np. Webshare: http://user:pass@p.webshare.io:80)
    HTTP_PROXY: Optional[str] = os.getenv("HTTP_PROXY") or os.getenv("HTTPS_PROXY")
    NO_PROXY: Optional[str] = os.getenv("NO_PROXY", "localhost,127.0.0.1")
    
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
    OPEN_METEO_ELEVATION_URL: str = "https://api.open-meteo.com/v1/elevation"
    SOILGRIDS_BASE_URL: str = "https://rest.isric.org/soilgrids/v2.0/properties/query"
    STAC_EARTH_SEARCH_URL: str = "https://earth-search.aws.element84.com/v1"
    GEOPORTAL_NMT_WCS_URL: str = "https://mapy.geoportal.gov.pl/wss/service/PZGIK/NMT/GRID1/WCS/DemService"
    GUGIK_NMT_URL: str = "https://services.gugik.gov.pl/nmt/"
    IMGW_HYDRO_URL: str = "https://danepubliczne.imgw.pl/api/data/hydro/"
    HYDROPORTAL_WMS_URL: str = "https://wody.isok.gov.pl/wss/INSPIRE/INSPIRE_HY_10k_2019_WMS"
    OVERPASS_API_URL: str = "https://overpass-api.de/api/interpreter"
    OVERPASS_FALLBACK_URL: str = "https://overpass.private.coffee/api/interpreter"


    # CORS origins (zgodne z wytycznymi bezpieczeństwa pkt 5.6)
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "https://145.239.90.237.nip.io",
        "https://kowr-front.vercel.app"
    ]

settings = Settings()

