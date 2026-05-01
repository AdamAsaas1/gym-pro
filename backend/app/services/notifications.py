from __future__ import annotations

import re
from dataclasses import dataclass

from app.core.config import Settings


@dataclass
class ChannelResult:
    channel: str
    status: str
    detail: str


def normalize_phone(raw_phone: str, default_country_code: str) -> str | None:
    digits = re.sub(r"\D", "", raw_phone or "")
    if not digits:
        return None

    # Convert local number format (example: 06xxxxxxxx) to international.
    if digits.startswith("00"):
        digits = digits[2:]
    elif digits.startswith("0"):
        digits = f"{default_country_code.lstrip('+')}{digits[1:]}"

    if len(digits) < 10:
        return None

    return f"+{digits}"


def _send_twilio_message(*, to: str, body: str, from_value: str, settings: Settings) -> tuple[bool, str]:
    try:
        from twilio.rest import Client  # Imported lazily so mock mode has no hard dependency.

        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        msg = client.messages.create(to=to, from_=from_value, body=body)
        return True, f"sid={msg.sid}"
    except Exception as exc:  # pragma: no cover - defensive runtime error handling
        return False, str(exc)


def send_whatsapp(to_phone: str, message: str, settings: Settings) -> ChannelResult:
    if settings.REMINDER_MODE != "live":
        return ChannelResult(channel="whatsapp", status="mock", detail="mock mode")

    if not settings.TWILIO_WHATSAPP_FROM:
        return ChannelResult(channel="whatsapp", status="skipped", detail="TWILIO_WHATSAPP_FROM missing")

    success, detail = _send_twilio_message(
        to=f"whatsapp:{to_phone}",
        body=message,
        from_value=settings.TWILIO_WHATSAPP_FROM,
        settings=settings,
    )
    return ChannelResult(channel="whatsapp", status="sent" if success else "failed", detail=detail)


def send_sms(to_phone: str, message: str, settings: Settings) -> ChannelResult:
    if settings.REMINDER_MODE != "live":
        return ChannelResult(channel="sms", status="mock", detail="mock mode")

    if not settings.TWILIO_SMS_FROM:
        return ChannelResult(channel="sms", status="skipped", detail="TWILIO_SMS_FROM missing")

    success, detail = _send_twilio_message(
        to=to_phone,
        body=message,
        from_value=settings.TWILIO_SMS_FROM,
        settings=settings,
    )
    return ChannelResult(channel="sms", status="sent" if success else "failed", detail=detail)
