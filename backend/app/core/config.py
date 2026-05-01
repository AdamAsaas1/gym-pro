from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str = "gympro_secret"

    # Reminder delivery mode: "mock" (safe test) or "live" (real sends)
    REMINDER_MODE: str = "mock"

    # Twilio config used in live mode
    TWILIO_ACCOUNT_SID: str | None = None
    TWILIO_AUTH_TOKEN: str | None = None
    TWILIO_WHATSAPP_FROM: str | None = None
    TWILIO_SMS_FROM: str | None = None

    # Used to normalize local phone numbers like 06xxxxxxx
    DEFAULT_COUNTRY_CODE: str = "+212"

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
