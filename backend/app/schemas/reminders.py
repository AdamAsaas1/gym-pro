from __future__ import annotations

from datetime import date
from typing import List

from pydantic import BaseModel, Field


class ReminderCandidateOut(BaseModel):
    membre_id: int
    nom_complet: str
    telephone: str
    email: str | None = None
    date_expiration: date
    days_before: int
    channels: List[str]


class ReminderSendRequest(BaseModel):
    days_before: int = Field(ge=0, le=30)
    dry_run: bool = False


class ReminderSendItemOut(BaseModel):
    membre_id: int
    nom_complet: str
    phone: str | None = None
    whatsapp_status: str
    whatsapp_detail: str
    sms_status: str
    sms_detail: str
    final_status: str


class ReminderSendSummaryOut(BaseModel):
    days_before: int
    dry_run: bool
    total_candidates: int
    sent_or_mock: int
    failed: int
    items: List[ReminderSendItemOut]
