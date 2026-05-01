import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
from app.core.config import get_settings
from app.services.notifications import normalize_phone

numbers = [
    "0662887220",
    "0623716936",
    "0635133286",
    "0698575223",
]

CONTENT_SID = "HXb5b62575e6e41f6129ad7c8efe1f983e"
CONTENT_VARIABLES = '{"1":"13/03","2":"10:00"}'

s = get_settings()
client = Client(s.TWILIO_ACCOUNT_SID, s.TWILIO_AUTH_TOKEN)

for raw in numbers:
    to = normalize_phone(raw, s.DEFAULT_COUNTRY_CODE)
    to_wa = f"whatsapp:{to}" if to else None
    print(f"input={raw} to={to_wa}")
    try:
        msg = client.messages.create(
            from_=s.TWILIO_WHATSAPP_FROM,
            to=to_wa,
            content_sid=CONTENT_SID,
            content_variables=CONTENT_VARIABLES,
        )
        status = client.messages(msg.sid).fetch()
        print(f"sid={msg.sid} status={status.status} error_code={status.error_code}")
    except TwilioRestException as exc:
        print(f"failed code={exc.code} message={exc.msg}")
    print("---")
