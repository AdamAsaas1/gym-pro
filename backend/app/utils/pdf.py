from fpdf import FPDF
from pathlib import Path


ABO_LABELS = {
    "mensuel":     "Mensuel (30 jours)",
    "trimestriel": "Trimestriel (90 jours)",
    "annuel":      "Annuel (365 jours)",
}

ACT_LABELS = {
    "musculation": "Musculation",
    "kickboxing":  "Kickboxing",
    "karate":      "Karaté",
    "aerobic":     "Aérobic",
}

BRAND_NAME = "ASAAS GYM"
BRAND_TAGLINE = "Salle de sport & Remise en forme"

# ASAAS theme colors (black/green)
CLR_DARK = (7, 10, 12)
CLR_DARK_2 = (14, 20, 24)
CLR_GREEN = (57, 255, 20)
CLR_GREEN_SOFT = (30, 70, 40)
CLR_TEXT = (232, 243, 240)
CLR_MUTED = (154, 174, 169)


def get_logo_path() -> Path | None:
    assets_dir = Path(__file__).resolve().parent.parent / "assets"
    for filename in (
        "logo_asaas.png",
        "logo_asaas.jpg",
        "logo_asaas.jpeg",
        "logo_asaas.webp",
        "asaas_logo.png",
        "asaas_logo.jpg",
        "asaas_logo.jpeg",
        "asaas_logo.webp",
        "logo.png",
        "logo.jpg",
        "logo.jpeg",
        "logo.webp",
    ):
        candidate = assets_dir / filename
        if candidate.exists():
            return candidate
    return None


def generer_recu_pdf(paiement, membre) -> bytes:
    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=False)
    logo_path = get_logo_path()

    # ── En-tête ──────────────────────────────────────────────────────────────
    pdf.set_fill_color(*CLR_DARK)
    pdf.rect(0, 0, 210, 44, "F")
    pdf.set_fill_color(*CLR_GREEN)
    pdf.rect(0, 44, 210, 1.5, "F")

    pdf.set_text_color(*CLR_TEXT)
    if logo_path:
        pdf.image(str(logo_path), x=12, y=8, w=22)
        pdf.set_font("Helvetica", "B", 20)
        pdf.set_xy(38, 10)
        pdf.cell(0, 10, BRAND_NAME, ln=False)
    else:
        pdf.set_font("Helvetica", "B", 22)
        pdf.set_xy(12, 10)
        pdf.cell(0, 10, BRAND_NAME, ln=False)

    pdf.set_font("Helvetica", "", 10)
    pdf.set_xy(38 if logo_path else 12, 24)
    pdf.cell(0, 6, BRAND_TAGLINE, ln=True)

    # Numéro de reçu (coin droit)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_xy(120, 12)
    pdf.cell(80, 7, f"RECU N° {paiement.id:04d}", align="R")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_xy(120, 20)
    pdf.cell(80, 6, f"Date : {paiement.date.strftime('%d/%m/%Y')}", align="R")

    # ── Titre ────────────────────────────────────────────────────────────────
    pdf.set_text_color(12, 18, 22)
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_xy(12, 54)
    pdf.cell(0, 10, "Reçu de Paiement", ln=True)

    # Ligne séparatrice
    pdf.set_draw_color(*CLR_GREEN)
    pdf.set_line_width(0.6)
    pdf.line(12, 66, 198, 66)

    # ── Infos membre ─────────────────────────────────────────────────────────
    pdf.set_fill_color(*CLR_DARK_2)
    pdf.rect(12, 72, 186, 52, "F")

    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*CLR_GREEN)
    pdf.set_xy(16, 74)
    pdf.cell(0, 7, "INFORMATIONS DU MEMBRE", ln=True)

    pdf.set_text_color(*CLR_TEXT)
    pdf.set_font("Helvetica", "", 10)

    nom_complet = f"{membre.prenom} {membre.nom}"
    activite    = ACT_LABELS.get(str(membre.activite.value if hasattr(membre.activite, 'value') else membre.activite), str(membre.activite))
    telephone   = membre.telephone
    email       = membre.email or "-"
    exp         = membre.date_expiration.strftime("%d/%m/%Y") if membre.date_expiration else "-"

    rows = [
        ("Nom & Prénom",  nom_complet),
        ("Téléphone",     telephone),
        ("Email",         email),
        ("Activité",      activite),
        ("Expire le",     exp),
    ]

    y = 83
    for label, val in rows:
        pdf.set_xy(16, y)
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(50, 6, f"{label} :", ln=False)
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 6, val, ln=True)
        y += 7

    # ── Détails paiement ─────────────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*CLR_GREEN)
    pdf.set_xy(16, 132)
    pdf.cell(0, 7, "DÉTAILS DU PAIEMENT", ln=True)

    abo_label = ABO_LABELS.get(
        str(paiement.abonnement.value if hasattr(paiement.abonnement, 'value') else paiement.abonnement),
        str(paiement.abonnement)
    )
    mode = str(paiement.mode.value if hasattr(paiement.mode, 'value') else paiement.mode)

    detail_rows = [
        ("Abonnement",        abo_label),
        ("Mode de paiement",  mode),
        ("Date de paiement",  paiement.date.strftime("%d/%m/%Y")),
    ]

    pdf.set_line_width(0.3)
    pdf.set_draw_color(44, 60, 52)

    y = 141
    for label, val in detail_rows:
        pdf.set_fill_color(*CLR_DARK_2)
        pdf.rect(12, y, 186, 9, "F")
        pdf.line(12, y + 9, 198, y + 9)
        pdf.set_xy(16, y + 1)
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*CLR_MUTED)
        pdf.cell(70, 7, label)
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(*CLR_TEXT)
        pdf.cell(0, 7, val, ln=True)
        y += 10

    # ── Total ─────────────────────────────────────────────────────────────────
    pdf.set_fill_color(*CLR_DARK)
    pdf.rect(12, y + 5, 186, 18, "F")
    pdf.set_text_color(*CLR_TEXT)
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_xy(16, y + 8)
    pdf.cell(100, 8, "TOTAL ENCAISSÉ")
    montant_str = f"{float(paiement.montant):,.2f} DH".replace(",", " ")
    pdf.set_xy(110, y + 8)
    pdf.cell(86, 8, montant_str, align="R")

    # ── Signature / Tampon ───────────────────────────────────────────────────
    pdf.set_text_color(*CLR_MUTED)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_xy(16, y + 30)
    pdf.cell(0, 5, "Signature & Cachet de la salle :", ln=True)
    pdf.set_draw_color(44, 60, 52)
    pdf.set_line_width(0.4)
    pdf.rect(16, y + 37, 60, 20)

    # ── Pied de page ─────────────────────────────────────────────────────────
    pdf.set_fill_color(*CLR_DARK)
    pdf.rect(0, 282, 210, 15, "F")
    pdf.set_text_color(*CLR_MUTED)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_xy(0, 286)
    pdf.cell(210, 5, "ASAAS GYM  ·  Ce reçu est votre justificatif de paiement  ·  Merci de votre confiance", align="C")

    return bytes(pdf.output())
