from typing import List
from fastapi import APIRouter
from app.models.schemas import CropInfo
from app.services.science.crops import CROP_DATABASE

router = APIRouter(prefix="/crops", tags=["Uprawy"])

@router.get("", response_model=List[CropInfo])
async def list_supported_crops():
    """
    Zwraca listę wspieranych upraw rolniczych wraz ze współczynnikami roślinnymi Kc (FAO-56),
    głębokością korzenienia i wrażliwością na suszę.
    """
    result = []
    for crop in CROP_DATABASE.values():
        result.append(CropInfo(
            id=crop["id"],
            name_pl=crop["name_pl"],
            kc_initial=crop["kc_initial"],
            kc_mid=crop["kc_mid"],
            kc_end=crop["kc_end"],
            root_depth_m=crop["root_depth_m"],
            drought_sensitivity=crop["drought_sensitivity"]
        ))
    return result

