from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import date
from backend.database import get_db
from backend.models import Expense, User
from backend.auth import get_current_user

router = APIRouter(prefix="/api/expenses", tags=["expenses"])


class ExpenseIn(BaseModel):
    branch_id: int
    date: date
    category: str = ""
    description: str = ""
    amount: float = 0
    payment_mode: str = "cash"
    notes: str = ""
    attachment: str = ""


@router.get("")
def list_expenses(branch_id: Optional[int] = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    bid = user.branch_id if user.role == "branch_user" else branch_id
    q = db.query(Expense)
    if bid:
        q = q.filter(Expense.branch_id == bid)
    return [_ser(r) for r in q.order_by(Expense.date.desc()).all()]


@router.post("")
def create_expense(data: ExpenseIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    bid = user.branch_id if user.role == "branch_user" else data.branch_id
    row = Expense(branch_id=bid, date=data.date, category=data.category,
                  description=data.description, amount=data.amount,
                  payment_mode=data.payment_mode, notes=data.notes, attachment=data.attachment)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _ser(row)


@router.put("/{eid}")
def update_expense(eid: int, data: ExpenseIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(Expense).filter(Expense.id == eid).first()
    if not row:
        raise HTTPException(404, "Not found")
    for k, v in data.dict().items():
        if k != "branch_id":
            setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return _ser(row)


@router.delete("/{eid}")
def delete_expense(eid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(Expense).filter(Expense.id == eid).first()
    if not row:
        raise HTTPException(404, "Not found")
    db.delete(row)
    db.commit()
    return {"ok": True}


def _ser(r):
    return {
        "id": r.id, "branch_id": r.branch_id, "date": str(r.date),
        "category": r.category, "description": r.description,
        "amount": r.amount, "payment_mode": r.payment_mode,
        "notes": r.notes, "attachment": r.attachment,
    }
