from typing import List, Optional
from datetime import date, timedelta
from sqlalchemy.orm import Session
from app.models.membre import Membre, Paiement, AbonnementEnum
from app.schemas.membre import MembreCreate, MembreUpdate, PaiementCreate
from app.core.catalog import ABONNEMENT_DURATIONS

# ─── Membres ──────────────────────────────────────────────────────────────────

def get_membres(db: Session) -> List[Membre]:
    return db.query(Membre).order_by(Membre.nom).all()


def get_membre(db: Session, membre_id: int) -> Optional[Membre]:
    return db.query(Membre).filter(Membre.id == membre_id).first()


def create_membre(db: Session, data: MembreCreate) -> Membre:
    membre = Membre(**data.model_dump())
    db.add(membre)
    db.commit()
    db.refresh(membre)
    return membre


def update_membre(db: Session, membre_id: int, data: MembreUpdate) -> Optional[Membre]:
    membre = get_membre(db, membre_id)
    if not membre:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(membre, field, value)
    db.commit()
    db.refresh(membre)
    return membre


def delete_membre(db: Session, membre_id: int) -> bool:
    membre = get_membre(db, membre_id)
    if not membre:
        return False
    db.delete(membre)
    db.commit()
    return True


def toggle_statut(db: Session, membre_id: int) -> Optional[Membre]:
    membre = get_membre(db, membre_id)
    if not membre:
        return None
    from app.models.membre import StatutEnum
    membre.statut = StatutEnum.inactif if membre.statut == StatutEnum.actif else StatutEnum.actif
    db.commit()
    db.refresh(membre)
    return membre


# ─── Paiements ────────────────────────────────────────────────────────────────

def get_paiements(db: Session) -> List[Paiement]:
    return db.query(Paiement).order_by(Paiement.date.desc()).all()


def create_paiement(db: Session, data: PaiementCreate) -> Optional[Paiement]:
    membre = get_membre(db, data.membre_id)
    if not membre:
        return None

    # Update member subscription
    from app.models.membre import StatutEnum
    duree        = ABONNEMENT_DURATIONS[data.abonnement.value]
    new_exp      = date.today() + timedelta(days=duree)
    membre.abonnement   = data.abonnement
    membre.statut       = StatutEnum.actif
    membre.date_expiration = new_exp

    paiement = Paiement(**data.model_dump())
    db.add(paiement)
    db.commit()
    db.refresh(paiement)
    return paiement


def get_paiement(db: Session, paiement_id: int) -> Optional[Paiement]:
    return db.query(Paiement).filter(Paiement.id == paiement_id).first()
