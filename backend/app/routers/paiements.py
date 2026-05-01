from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.membre import PaiementCreate, PaiementOut, PaiementWorkflowRequest, PaiementWorkflowResponse
from app.services.reminders import send_reminders
from app.utils.pdf import generer_recu_pdf
import app.crud as crud

router = APIRouter(prefix="/paiements", tags=["paiements"])


@router.get("/", response_model=List[PaiementOut])
def list_paiements(db: Session = Depends(get_db)):
    return crud.get_paiements(db)


@router.post("/", response_model=PaiementOut, status_code=status.HTTP_201_CREATED)
def create_paiement(data: PaiementCreate, db: Session = Depends(get_db)):
    paiement = crud.create_paiement(db, data)
    if not paiement:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membre introuvable")
    return paiement


@router.post("/workflow", response_model=PaiementWorkflowResponse, status_code=status.HTTP_201_CREATED)
def create_paiement_workflow(payload: PaiementWorkflowRequest, db: Session = Depends(get_db)):
    paiement = crud.create_paiement(db, payload.paiement)
    if not paiement:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membre introuvable")

    membre = crud.get_membre(db, paiement.membre_id)
    if not membre:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membre introuvable")

    reminders_summary = None
    if payload.send_reminders:
        reminders_summary = send_reminders(
            db,
            days_before=payload.days_before,
            dry_run=payload.dry_run,
        )

    return PaiementWorkflowResponse(
        paiement=paiement,
        reminders=reminders_summary,
    )


@router.get("/{paiement_id}/recu")
def telecharger_recu(paiement_id: int, db: Session = Depends(get_db)):
    paiement = crud.get_paiement(db, paiement_id)
    if not paiement:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paiement introuvable")
    membre = crud.get_membre(db, paiement.membre_id)
    if not membre:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membre introuvable")

    pdf_bytes = generer_recu_pdf(paiement, membre)
    filename  = f"recu_{paiement_id:04d}_{membre.nom}_{membre.prenom}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
