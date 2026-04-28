import os
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.database import engine, get_db
from backend.models import Base
from backend.seed import seed
from backend.auth import get_current_user
from backend.routers import (
    auth_router,
    sales_router,
    purchases_router,
    expenses_router,
    hr_router,
    cash_router,
    dashboard_router,
    export_router,
)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@asynccontextmanager
async def lifespan(application: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed()
    yield


app = FastAPI(title="Mudawwarah", lifespan=lifespan)

app.include_router(auth_router.router)
app.include_router(sales_router.router)
app.include_router(purchases_router.router)
app.include_router(expenses_router.router)
app.include_router(hr_router.router)
app.include_router(cash_router.router)
app.include_router(dashboard_router.router)
app.include_router(export_router.router)


@app.post("/api/upload")
async def upload_file(file: UploadFile, _user=Depends(get_current_user)):
    path = os.path.join(UPLOAD_DIR, file.filename)
    with open(path, "wb") as f:
        f.write(await file.read())
    return {"filename": file.filename}


@app.get("/api/files/{filename}")
async def get_file(filename: str):
    path = os.path.join(UPLOAD_DIR, filename)
    if os.path.exists(path):
        return FileResponse(path)
    return {"error": "Not found"}


STATIC_DIR = Path(__file__).resolve().parent / "frontend" / "dist"
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = STATIC_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(STATIC_DIR / "index.html"))
