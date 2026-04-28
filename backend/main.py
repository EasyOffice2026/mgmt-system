import os
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from backend.database import Base, engine
from backend.seed import seed
from backend.routers import auth_router, sales_router, purchases_router, expenses_router, hr_router, cash_router, dashboard_router, export_router
from backend.auth import get_current_user

Base.metadata.create_all(bind=engine)
seed()

app = FastAPI(title="Mudawwarah Restaurant Management")

app.include_router(auth_router.router)
app.include_router(sales_router.router)
app.include_router(purchases_router.router)
app.include_router(expenses_router.router)
app.include_router(hr_router.router)
app.include_router(cash_router.router)
app.include_router(dashboard_router.router)
app.include_router(export_router.router)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/data/uploads" if os.path.isdir("/data") else "./uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), user=Depends(get_current_user)):
    import uuid
    ext = Path(file.filename).suffix
    fname = f"{uuid.uuid4().hex}{ext}"
    fpath = os.path.join(UPLOAD_DIR, fname)
    with open(fpath, "wb") as f:
        content = await file.read()
        f.write(content)
    return {"filename": fname, "url": f"/api/files/{fname}"}


@app.get("/api/files/{filename}")
async def get_file(filename: str):
    fpath = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(fpath):
        return {"error": "File not found"}
    return FileResponse(fpath)


# Serve React frontend
STATIC_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = STATIC_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(STATIC_DIR / "index.html"))
