from __future__ import annotations
from datetime import date
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, EmailStr, field_validator
from app.models.membre import GenreEnum, StatutEnum, AbonnementEnum, ActiviteEnum, ModeEnum
from app.schemas.reminders import ReminderSendSummaryOut


# ─── Membre ───────────────────────────────────────────────────────────────────

class MembreBase(BaseModel):
    nom:              str
    prenom:           str
    genre:            GenreEnum
    activite:         ActiviteEnum
    abonnement:       AbonnementEnum
    statut:           StatutEnum        = StatutEnum.actif
    telephone:        str
    email:            Optional[str]     = ""
    date_naissance:   Optional[date]    = None
    date_inscription: date
    date_expiration:  date
    photo_base64:     Optional[str]     = None


class MembreCreate(MembreBase):
    pass


class MembreUpdate(BaseModel):
    nom:              Optional[str]            = None
    prenom:           Optional[str]            = None
    genre:            Optional[GenreEnum]      = None
    activite:         Optional[ActiviteEnum]   = None
    abonnement:       Optional[AbonnementEnum] = None
    statut:           Optional[StatutEnum]     = None
    telephone:        Optional[str]            = None
    email:            Optional[str]            = None
    date_naissance:   Optional[date]           = None
    date_inscription: Optional[date]           = None
    date_expiration:  Optional[date]           = None
    photo_base64:     Optional[str]            = None


class PaiementOut(BaseModel):
    id:         int
    membre_id:  int
    abonnement: AbonnementEnum
    montant:    Decimal
    mode:       ModeEnum
    date:       date

    model_config = {"from_attributes": True}


class MembreOut(MembreBase):
    id:        int
    paiements: List[PaiementOut] = []

    model_config = {"from_attributes": True}


# ─── Paiement ─────────────────────────────────────────────────────────────────

class PaiementCreate(BaseModel):
    membre_id:  int
    abonnement: AbonnementEnum
    montant:    Decimal
    mode:       ModeEnum        = ModeEnum.especes
    date:       date


class PaiementWorkflowRequest(BaseModel):
    paiement: PaiementCreate
    send_reminders: bool = False
    days_before: int = 3
    dry_run: bool = True


class PaiementWorkflowResponse(BaseModel):
    paiement: PaiementOut
    reminders: Optional[ReminderSendSummaryOut] = None

