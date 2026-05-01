from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.reminders import ReminderCandidateOut, ReminderSendRequest, ReminderSendSummaryOut
from app.services.reminders import candidates_to_schema, get_candidates, send_reminders

router = APIRouter(prefix="/rappels", tags=["rappels"])


@router.get("/candidats", response_model=list[ReminderCandidateOut])
def list_candidates(
    days_before: int = Query(default=3, ge=0, le=30),
    db: Session = Depends(get_db),
):
    candidates = get_candidates(db, days_before=days_before)
    return candidates_to_schema(candidates)


@router.post("/envoyer", response_model=ReminderSendSummaryOut)
def envoyer_rappels(payload: ReminderSendRequest, db: Session = Depends(get_db)):
    return send_reminders(db, days_before=payload.days_before, dry_run=payload.dry_run)


@router.get("/strategie")
def strategie_rappels():
    return {
        "policy": "whatsapp-first-then-sms-fallback",
        "recommended_schedule": [7, 3, 1, 0],
        "strict_rule": "no payment, no active access",
    }
