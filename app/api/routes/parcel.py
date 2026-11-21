from fastapi import APIRouter, Query, HTTPException
from app.models.schemas import ParcelSearchResponse
from app.services.gis.uldk import fetch_parcel_from_uldk

router = APIRouter(prefix="/parcel", tags=["Działka"])

@router.get("/search", response_model=ParcelSearchResponse)
async def search_parcel(
    teryt: str = Query(..., description="Identyfikator TERYT działki, np. 141201_1.0001.123/4", examples=["141201_1.0001.123/4"])
):
    """
    Szybkie wyszukanie geometrii i podstawowych parametrów działki na podstawie numeru TERYT.
    Zwraca geometrię w formacie GeoJSON EPSG:4326, punkt reprezentatywny do map.fitBounds() oraz powierzchnię w ha.
    """
    if not teryt or len(teryt.strip()) < 5:
        raise HTTPException(status_code=400, detail="Niepoprawny format identyfikatora TERYT.")
    
    try:
        parcel_data = await fetch_parcel_from_uldk(teryt)
        return parcel_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Błąd przetwarzania działki TERYT: {str(e)}")
