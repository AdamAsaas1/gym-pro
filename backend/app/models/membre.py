from sqlalchemy import Column, Integer, String, Date, Numeric, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base


class GenreEnum(str, enum.Enum):
    homme  = "homme"
    femme  = "femme"
    enfant = "enfant"


class StatutEnum(str, enum.Enum):
    actif   = "actif"
    inactif = "inactif"


class AbonnementEnum(str, enum.Enum):
    mensuel     = "mensuel"
    trimestriel = "trimestriel"
    annuel      = "annuel"


class ActiviteEnum(str, enum.Enum):
    musculation = "musculation"
    kickboxing  = "kickboxing"
    karate      = "karate"
    aerobic     = "aerobic"


class ModeEnum(str, enum.Enum):
    especes  = "Espèces"
    virement = "Virement"
    cheque   = "Chèque"


class Membre(Base):
    __tablename__ = "membres"

    id               = Column(Integer, primary_key=True, index=True)
    nom              = Column(String(80),  nullable=False)
    prenom           = Column(String(80),  nullable=False)
    genre            = Column(Enum(GenreEnum),       nullable=False)
    activite         = Column(Enum(ActiviteEnum),    nullable=False)
    abonnement       = Column(Enum(AbonnementEnum),  nullable=False)
    statut           = Column(Enum(StatutEnum),      nullable=False, default="actif")
    telephone        = Column(String(20),  nullable=False)
    email            = Column(String(120), nullable=True, default="")
    date_naissance   = Column(Date,        nullable=True)
    date_inscription = Column(Date,        nullable=False)
    date_expiration  = Column(Date,        nullable=False)
    photo_base64     = Column(Text,        nullable=True)

    paiements = relationship("Paiement", back_populates="membre", cascade="all, delete-orphan")


class Paiement(Base):
    __tablename__ = "paiements"

    id          = Column(Integer, primary_key=True, index=True)
    membre_id   = Column(Integer, ForeignKey("membres.id", ondelete="CASCADE"), nullable=False)
    abonnement  = Column(Enum(AbonnementEnum), nullable=False)
    montant     = Column(Numeric(10, 2),       nullable=False)
    mode        = Column(Enum(ModeEnum),       nullable=False, default="Espèces")
    date        = Column(Date,                 nullable=False)

    membre = relationship("Membre", back_populates="paiements")
