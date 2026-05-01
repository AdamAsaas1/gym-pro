from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from app.core.database import Base, engine
from app.routers import membres_router, paiements_router, rappels_router, config_router

# Create all tables via Alembic migrations in production

app = FastAPI(
    title="ASAAS GYM API",
    version="1.0.0",
    description="API de gestion de salle de sport",
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://localhost:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(membres_router)
app.include_router(paiements_router)
app.include_router(rappels_router)
app.include_router(config_router)


@app.on_event("startup")
def ensure_photo_column():
    with engine.begin() as conn:
        inspector = inspect(conn)
        if "membres" not in inspector.get_table_names():
            return
        columns = {col["name"] for col in inspector.get_columns("membres")}
        if "photo_base64" not in columns:
            conn.execute(text("ALTER TABLE membres ADD COLUMN photo_base64 TEXT"))


@app.get("/")
def root():
    return {"message": "ASAAS GYM API is running"}
