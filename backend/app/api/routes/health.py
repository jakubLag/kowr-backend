from datetime import datetime
from fastapi import APIRouter
import httpx
from app.core.config import settings
from app.models.schemas import HealthResponse

router = APIRouter(prefix="/health", tags=["Monitoring"])

@router.get("", response_model=HealthResponse)
async def check_health():
    """
    Sprawdza status dostępności kluczowych usług zewnętrznych:
    - ULDK GUGiK
    - Open-Meteo API
    - AWS Earth Search STAC
    - ISRIC SoilGrids
    """
    services_status = {
        "uldk": False,
        "open_meteo": False,
        "aws_stac": False,
        "soilgrids": False
    }

    async def ping_service(name: str, url: str) -> None:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(url)
                if resp.status_code in [200, 301, 302, 400]:
                    services_status[name] = True
        except Exception:
            services_status[name] = False

    # Sprawdzenia z krótkim timeoutem
    await ping_service("uldk", f"{settings.ULDK_BASE_URL}?funkcja=GetParcelByIdOrNr&id=0000")
    await ping_service("open_meteo", "https://api.open-meteo.com/v1/forecast?latitude=52&longitude=21&daily=precipitation_sum&timezone=auto")
    await ping_service("aws_stac", f"{settings.STAC_EARTH_SEARCH_URL}")
    await ping_service("soilgrids", "https://rest.isric.org/soilgrids/v2.0/properties/query?lat=52&lon=21&property=sand")

    overall_ok = any(services_status.values())
    status_str = "healthy" if all(services_status.values()) else ("degraded" if overall_ok else "unhealthy")

    return HealthResponse(
        status=status_str,
        services=services_status,
        timestamp=datetime.now().isoformat()
    )

