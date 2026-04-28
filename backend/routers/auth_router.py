from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import User, Branch
from backend.auth import verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form.username).first()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    branch_name = ""
    branch_name_ar = ""
    if user.branch:
        branch_name = user.branch.name
        branch_name_ar = user.branch.name_ar
    token = create_access_token({"sub": user.id, "role": user.role, "branch_id": user.branch_id})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role,
            "branch_id": user.branch_id,
            "branch_name": branch_name,
            "branch_name_ar": branch_name_ar,
        },
    }


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    branch_name = ""
    branch_name_ar = ""
    if user.branch:
        branch_name = user.branch.name
        branch_name_ar = user.branch.name_ar
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role,
        "branch_id": user.branch_id,
        "branch_name": branch_name,
        "branch_name_ar": branch_name_ar,
    }


@router.get("/branches")
def list_branches(db: Session = Depends(get_db)):
    branches = db.query(Branch).order_by(Branch.id).all()
    return [{"id": b.id, "name": b.name, "name_ar": b.name_ar, "is_kitchen": b.is_kitchen} for b in branches]
