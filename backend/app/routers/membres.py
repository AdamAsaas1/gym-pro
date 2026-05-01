from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.membre import MembreCreate, MembreUpdate, MembreOut
import app.crud as crud

router = APIRouter(prefix="/membres", tags=["membres"])


@router.get("/", response_model=List[MembreOut])
def list_membres(db: Session = Depends(get_db)):
    return crud.get_membres(db)


@router.get("/{membre_id}", response_model=MembreOut)
def get_membre(membre_id: int, db: Session = Depends(get_db)):
    membre = crud.get_membre(db, membre_id)
    if not membre:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membre introuvable")
    return membre


@router.post("/", response_model=MembreOut, status_code=status.HTTP_201_CREATED)
def create_membre(data: MembreCreate, db: Session = Depends(get_db)):
    return crud.create_membre(db, data)


@router.put("/{membre_id}", response_model=MembreOut)
def update_membre(membre_id: int, data: MembreUpdate, db: Session = Depends(get_db)):
    membre = crud.update_membre(db, membre_id, data)
    if not membre:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membre introuvable")
    return membre


@router.delete("/{membre_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_membre(membre_id: int, db: Session = Depends(get_db)):
    if not crud.delete_membre(db, membre_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membre introuvable")


@router.patch("/{membre_id}/toggle", response_model=MembreOut)
def toggle_statut(membre_id: int, db: Session = Depends(get_db)):
    membre = crud.toggle_statut(db, membre_id)
    if not membre:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membre introuvable")
    return membre
