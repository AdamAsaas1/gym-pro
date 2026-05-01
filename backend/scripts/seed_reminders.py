import datetime

from app.core.database import SessionLocal
from app.models.membre import Membre


def seed_membres():
    today = datetime.date.today()

    membres = [
        {
            "nom": "TEST_REM",
            "prenom": "Salma",
            "genre": "femme",
            "activite": "aerobic",
            "abonnement": "mensuel",
            "statut": "actif",
            "telephone": "0677-200-201",
            "email": "salma.reminder@email.com",
            "date_naissance": datetime.date(1999, 2, 16),
            "date_inscription": today - datetime.timedelta(days=28),
            "date_expiration": today + datetime.timedelta(days=2),
        },
        {
            "nom": "TEST_REM",
            "prenom": "Nabil",
            "genre": "homme",
            "activite": "musculation",
            "abonnement": "mensuel",
            "statut": "actif",
            "telephone": "0677-200-202",
            "email": "nabil.reminder@email.com",
            "date_naissance": datetime.date(1991, 11, 3),
            "date_inscription": today - datetime.timedelta(days=35),
            "date_expiration": today + datetime.timedelta(days=1),
        },
        {
            "nom": "TEST_REM",
            "prenom": "Hajar",
            "genre": "femme",
            "activite": "kickboxing",
            "abonnement": "mensuel",
            "statut": "actif",
            "telephone": "0677-200-203",
            "email": "hajar.reminder@email.com",
            "date_naissance": datetime.date(1996, 6, 28),
            "date_inscription": today - datetime.timedelta(days=20),
            "date_expiration": today + datetime.timedelta(days=3),
        },
        {
            "nom": "TEST_REM",
            "prenom": "Yassine",
            "genre": "homme",
            "activite": "karate",
            "abonnement": "mensuel",
            "statut": "actif",
            "telephone": "0677-200-204",
            "email": "yassine.reminder@email.com",
            "date_naissance": datetime.date(2002, 9, 19),
            "date_inscription": today - datetime.timedelta(days=12),
            "date_expiration": today,
        },
    ]

    db = SessionLocal()
    try:
        created = []
        for payload in membres:
            membre = Membre(**payload)
            db.add(membre)
            db.flush()
            created.append((membre.id, membre.prenom, membre.nom, membre.date_expiration))
        db.commit()
    finally:
        db.close()

    print("Inserted members:")
    for row in created:
        print(row)


if __name__ == "__main__":
    seed_membres()
