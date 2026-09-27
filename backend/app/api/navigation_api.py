from fastapi import APIRouter, Depends

from app.core.auth import require_roles
from app.schemas.navigation_schemas import MapMatchRequest, MapMatchResponse
from app.services.navegacion_services import map_match_navigation, navigation_health


router = APIRouter(prefix="/navigation", tags=["Navegación"])


@router.get("/health")
async def health_navegacion():
    return await navigation_health()


@router.post(
    "/map-match",
    response_model=MapMatchResponse,
    dependencies=[Depends(require_roles("conductor", "coordinador"))],
)
async def map_match(request: MapMatchRequest):
    return await map_match_navigation([point.model_dump() for point in request.points])
