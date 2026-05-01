from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import List

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.membre import Membre, StatutEnum
from app.schemas.reminders import ReminderCandidateOut, ReminderSendItemOut, ReminderSendSummaryOut
from app.services.notifications import normalize_phone, send_sms, send_whatsapp


@dataclass
class ReminderCandidate:
    membre: Membre
    days_before: int
    channels: List[str]


def _build_message(membre: Membre, days_before: int) -> str:
    full_name = f"{membre.prenom} {membre.nom}".strip()
    exp = membre.date_expiration.strftime("%d/%m/%Y")

    if days_before > 1:
        return (
            f"ASAAS GYM: Bonjour {full_name}, votre abonnement expire dans {days_before} jours "
            f"(le {exp}). Merci de renouveler a l'avance pour garder votre acces actif."
        )

    if days_before == 1:
        return (
            f"ASAAS GYM: Bonjour {full_name}, votre abonnement expire demain ({exp}). "
            "Renouvelez aujourd'hui pour eviter la suspension d'acces."
        )

    return (
        f"ASAAS GYM: Bonjour {full_name}, votre abonnement expire aujourd'hui ({exp}). "
        "Veuillez renouveler maintenant pour conserver votre acces."
    )


def get_candidates(db: Session, days_before: int) -> List[ReminderCandidate]:
    target_date = date.today() + timedelta(days=days_before)

    membres = (
        db.query(Membre)
        .filter(Membre.date_expiration == target_date)
        .filter(Membre.statut == StatutEnum.actif)
        .order_by(Membre.nom.asc(), Membre.prenom.asc())
        .all()
    )

    settings = get_settings()
    out: List[ReminderCandidate] = []

    for membre in membres:
        channels: List[str] = []
        if normalize_phone(membre.telephone, settings.DEFAULT_COUNTRY_CODE):
            channels.extend(["whatsapp", "sms"])
        out.append(ReminderCandidate(membre=membre, days_before=days_before, channels=channels))

    return out


def candidates_to_schema(candidates: List[ReminderCandidate]) -> List[ReminderCandidateOut]:
    results: List[ReminderCandidateOut] = []
    for c in candidates:
        results.append(
            ReminderCandidateOut(
                membre_id=c.membre.id,
                nom_complet=f"{c.membre.prenom} {c.membre.nom}",
                telephone=c.membre.telephone,
                email=c.membre.email,
                date_expiration=c.membre.date_expiration,
                days_before=c.days_before,
                channels=c.channels,
            )
        )
    return results


def send_reminders(db: Session, days_before: int, dry_run: bool) -> ReminderSendSummaryOut:
    settings = get_settings()
    candidates = get_candidates(db, days_before)

    items: List[ReminderSendItemOut] = []
    success_count = 0
    failed_count = 0

    for c in candidates:
        full_name = f"{c.membre.prenom} {c.membre.nom}"
        normalized_phone = normalize_phone(c.membre.telephone, settings.DEFAULT_COUNTRY_CODE)

        if not normalized_phone:
            failed_count += 1
            items.append(
                ReminderSendItemOut(
                    membre_id=c.membre.id,
                    nom_complet=full_name,
                    phone=None,
                    whatsapp_status="skipped",
                    whatsapp_detail="invalid phone",
                    sms_status="skipped",
                    sms_detail="invalid phone",
                    final_status="failed",
                )
            )
            continue

        if dry_run:
            success_count += 1
            items.append(
                ReminderSendItemOut(
                    membre_id=c.membre.id,
                    nom_complet=full_name,
                    phone=normalized_phone,
                    whatsapp_status="dry-run",
                    whatsapp_detail="dry run",
                    sms_status="dry-run",
                    sms_detail="dry run",
                    final_status="dry-run",
                )
            )
            continue

        body = _build_message(c.membre, days_before)

        # Primary channel: WhatsApp. Fallback channel: SMS.
        wa = send_whatsapp(normalized_phone, body, settings)
        if wa.status in {"sent", "mock"}:
            sms_status = "not-needed"
            sms_detail = "whatsapp delivered"
            final_status = "ok"
            success_count += 1
        else:
            sms = send_sms(normalized_phone, body, settings)
            sms_status = sms.status
            sms_detail = sms.detail
            if sms.status in {"sent", "mock"}:
                final_status = "ok-fallback-sms"
                success_count += 1
            else:
                final_status = "failed"
                failed_count += 1

        items.append(
            ReminderSendItemOut(
                membre_id=c.membre.id,
                nom_complet=full_name,
                phone=normalized_phone,
                whatsapp_status=wa.status,
                whatsapp_detail=wa.detail,
                sms_status=sms_status,
                sms_detail=sms_detail,
                final_status=final_status,
            )
        )

    return ReminderSendSummaryOut(
        days_before=days_before,
        dry_run=dry_run,
        total_candidates=len(candidates),
        sent_or_mock=success_count,
        failed=failed_count,
        items=items,
    )
