import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.core.config import get_settings
from app.services.notifications import normalize_phone, send_whatsapp
from twilio.rest import Client

numbers = [
    "0662887220",
    "0623716936",
    "0635133286",
    "0698575223",
]

msg = (
    "ASAAS GYM: Bonjour, rappel abonnement. Merci de renouveler "
    "votre abonnement pour garder votre acces actif."
)

s = get_settings()
client = Client(s.TWILIO_ACCOUNT_SID, s.TWILIO_AUTH_TOKEN)

for n in numbers:
    to = normalize_phone(n, s.DEFAULT_COUNTRY_CODE)
    result = send_whatsapp(to, msg, s) if to else None
    print(f"input={n} to={to} send={result}")
    if result and result.detail.startswith("sid="):
        sid = result.detail.split("=", 1)[1]
        message = client.messages(sid).fetch()
        print(f"sid={sid} status={message.status} error_code={message.error_code}")
    print("---")
