from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from pydantic import BaseModel
from typing import Optional
from datetime import date
from backend.database import get_db
from backend.models import DailySales, User
from backend.auth import get_current_user

router = APIRouter(prefix="/api/sales", tags=["sales"])


class SalesIn(BaseModel):
    branch_id: int
    date: date
    cash: float = 0
    knet: float = 0
    link: float = 0
    wamd: float = 0
    talabat: float = 0
    jahez: float = 0
    keeta: float = 0
    foodics_total: float = 0
    notes: str = ""
    attachment: str = ""


def _branch_filter(user: User, requested_branch_id: Optional[int]):
    if user.role == "branch_user":
        return user.branch_id
    return requested_branch_id


@router.get("")
def list_sales(
    branch_id: Optional[int] = None,
    month: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    bid = _branch_filter(user, branch_id)
    q = db.query(DailySales)
    if bid:
        q = q.filter(DailySales.branch_id == bid)
    if month:
        q = q.filter(DailySales.date.like(f"{month}%"))
    rows = q.order_by(DailySales.date.desc()).all()
    return [_serialize(r) for r in rows]


@router.post("")
def create_sale(data: SalesIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    bid = _branch_filter(user, data.branch_id)
    if not bid:
        raise HTTPException(400, "Branch required")
    existing = db.query(DailySales).filter(and_(DailySales.branch_id == bid, DailySales.date == data.date)).first()
    if existing:
        raise HTTPException(400, "Sales entry already exists for this date and branch")
    physical = data.cash + data.knet + data.link + data.wamd + data.talabat + data.jahez + data.keeta
    row = DailySales(
        branch_id=bid, date=data.date, cash=data.cash, knet=data.knet,
        link=data.link, wamd=data.wamd, talabat=data.talabat, jahez=data.jahez,
        keeta=data.keeta, foodics_total=data.foodics_total,
        physical_total=physical, difference=physical - data.foodics_total,
        notes=data.notes, attachment=data.attachment,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize(row)


@router.put("/{sale_id}")
def update_sale(sale_id: int, data: SalesIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(DailySales).filter(DailySales.id == sale_id).first()
    if not row:
        raise HTTPException(404, "Not found")
    physical = data.cash + data.knet + data.link + data.wamd + data.talabat + data.jahez + data.keeta
    for k, v in data.dict().items():
        if k not in ("branch_id",):
            setattr(row, k, v)
    row.physical_total = physical
    row.difference = physical - data.foodics_total
    db.commit()
    db.refresh(row)
    return _serialize(row)


@router.delete("/{sale_id}")
def delete_sale(sale_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(DailySales).filter(DailySales.id == sale_id).first()
    if not row:
        raise HTTPException(404, "Not found")
    db.delete(row)
    db.commit()
    return {"ok": True}


def _serialize(r: DailySales):
    return {
        "id": r.id, "branch_id": r.branch_id, "date": str(r.date),
        "cash": r.cash, "knet": r.knet, "link": r.link, "wamd": r.wamd,
        "talabat": r.talabat, "jahez": r.jahez, "keeta": r.keeta,
        "foodics_total": r.foodics_total, "physical_total": r.physical_total,
        "difference": r.difference, "notes": r.notes, "attachment": r.attachment,
    }
