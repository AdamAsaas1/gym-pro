from app.routers.membres  import router as membres_router
from app.routers.paiements import router as paiements_router
from app.routers.rappels import router as rappels_router
from app.routers.config import router as config_router

__all__ = ["membres_router", "paiements_router", "rappels_router", "config_router"]
