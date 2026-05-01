from fastapi import APIRouter

from app.core.catalog import ABONNEMENT_DURATIONS, ACTIVITE_PRIX

router = APIRouter(prefix="/config", tags=["config"])


@router.get("")
def get_config():
    return {
        "abonnement_durations": ABONNEMENT_DURATIONS,
        "activite_prix": ACTIVITE_PRIX,
    }
