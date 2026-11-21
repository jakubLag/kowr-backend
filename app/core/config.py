import os
from typing import List
from pydantic import BaseModel

class Settings(BaseModel):
    PROJECT_NAME: str = "KOWR - Zatrzymaj wodę, chroń plony"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api"
    
    # Timeouts (sec) - strict 7s timeout per external service as per specification
    SERVICE_TIMEOUT_SECONDS: float = 7.0
    
    # External APIs
    ULDK_BASE_URL: str = "https://uldk.gugik.gov.pl/service.php"
    OPEN_METEO_BASE_URL: str = "https://archive-api.open-meteo.com/v1/archive"
    OPEN_METEO_FORECAST_URL: str = "https://api.open-meteo.com/v1/forecast"
    SOILGRIDS_BASE_URL: str = "https://rest.isric.org/soilgrids/v2.0/properties/query"
    STAC_EARTH_SEARCH_URL: str = "https://earth-search.aws.element84.com/v1"
    GEOPORTAL_NMT_WCS_URL: str = "https://mapy.geoportal.gov.pl/wss/service/PZGIK/NMT/GRID1/WCS/DemService"
    OVERPASS_API_URL: str = "https://overpass-api.de/api/interpreter"

    # CORS origins
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "*"
    ]

settings = Settings()

