from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import date
from backend.database import get_db
from backend.models import PurchaseOrder, Item, User
from backend.auth import get_current_user

router = APIRouter(prefix="/api/purchases", tags=["purchases"])


class PurchaseIn(BaseModel):
    branch_id: int
    date: date
    supplier: str = ""
    item_id: Optional[int] = None
    item_name: str = ""
    quantity: float = 0
    unit_price: float = 0
    payment_mode: str = "cash"
    notes: str = ""
    attachment: str = ""


class ItemIn(BaseModel):
    name: str
    name_ar: str = ""
    unit_price: float = 0
    unit: str = "piece"
    category: str = ""


@router.get("")
def list_purchases(branch_id: Optional[int] = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    bid = user.branch_id if user.role == "branch_user" else branch_id
    q = db.query(PurchaseOrder)
    if bid:
        q = q.filter(PurchaseOrder.branch_id == bid)
    return [_ser(r) for r in q.order_by(PurchaseOrder.date.desc()).all()]


@router.post("")
def create_purchase(data: PurchaseIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    bid = user.branch_id if user.role == "branch_user" else data.branch_id
    total = data.quantity * data.unit_price
    row = PurchaseOrder(branch_id=bid, date=data.date, supplier=data.supplier,
                        item_id=data.item_id, item_name=data.item_name,
                        quantity=data.quantity, unit_price=data.unit_price,
                        total=total, payment_mode=data.payment_mode,
                        notes=data.notes, attachment=data.attachment)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _ser(row)


@router.put("/{pid}")
def update_purchase(pid: int, data: PurchaseIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(PurchaseOrder).filter(PurchaseOrder.id == pid).first()
    if not row:
        raise HTTPException(404, "Not found")
    for k, v in data.dict().items():
        if k != "branch_id":
            setattr(row, k, v)
    row.total = data.quantity * data.unit_price
    db.commit()
    db.refresh(row)
    return _ser(row)


@router.delete("/{pid}")
def delete_purchase(pid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(PurchaseOrder).filter(PurchaseOrder.id == pid).first()
    if not row:
        raise HTTPException(404, "Not found")
    db.delete(row)
    db.commit()
    return {"ok": True}


# ---- Items ----
@router.get("/items")
def list_items(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [{"id": i.id, "name": i.name, "name_ar": i.name_ar, "unit_price": i.unit_price, "unit": i.unit, "category": i.category} for i in db.query(Item).order_by(Item.name).all()]


@router.post("/items")
def create_item(data: ItemIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    item = Item(name=data.name, name_ar=data.name_ar, unit_price=data.unit_price, unit=data.unit, category=data.category)
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id, "name": item.name, "name_ar": item.name_ar, "unit_price": item.unit_price, "unit": item.unit, "category": item.category}


@router.delete("/items/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(404, "Not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


def _ser(r):
    return {
        "id": r.id, "branch_id": r.branch_id, "date": str(r.date),
        "supplier": r.supplier, "item_id": r.item_id, "item_name": r.item_name,
        "quantity": r.quantity, "unit_price": r.unit_price, "total": r.total,
        "payment_mode": r.payment_mode, "notes": r.notes, "attachment": r.attachment,
    }
