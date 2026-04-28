from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional
from datetime import date
from backend.database import get_db
from backend.models import CashEntry, DailySales, PurchaseOrder, Expense, User
from backend.auth import get_current_user

router = APIRouter(prefix="/api/cash", tags=["cash"])


class CashIn(BaseModel):
    branch_id: int
    date: date
    opening_balance: float = 0
    deposited: float = 0
    notes: str = ""


@router.get("")
def list_cash(branch_id: Optional[int] = None, month: Optional[str] = None,
              db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    bid = user.branch_id if user.role == "branch_user" else branch_id
    q = db.query(CashEntry)
    if bid:
        q = q.filter(CashEntry.branch_id == bid)
    if month:
        q = q.filter(CashEntry.date.like(f"{month}%"))
    return [_ser(r) for r in q.order_by(CashEntry.date.desc()).all()]


@router.post("")
def create_cash(data: CashIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    bid = user.branch_id if user.role == "branch_user" else data.branch_id
    if not bid:
        raise HTTPException(400, "Branch required")
    cash_sales = db.query(func.coalesce(func.sum(DailySales.cash), 0)).filter(
        DailySales.branch_id == bid, DailySales.date == data.date).scalar()
    cash_purchases = db.query(func.coalesce(func.sum(PurchaseOrder.total), 0)).filter(
        PurchaseOrder.branch_id == bid, PurchaseOrder.date == data.date,
        PurchaseOrder.payment_mode == "cash").scalar()
    cash_expenses = db.query(func.coalesce(func.sum(Expense.amount), 0)).filter(
        Expense.branch_id == bid, Expense.date == data.date,
        Expense.payment_mode == "cash").scalar()
    closing = data.opening_balance + float(cash_sales) - float(cash_purchases) - float(cash_expenses) - data.deposited
    row = CashEntry(branch_id=bid, date=data.date, opening_balance=data.opening_balance,
                    cash_sales=float(cash_sales), cash_purchases=float(cash_purchases),
                    cash_expenses=float(cash_expenses), deposited=data.deposited,
                    closing_balance=closing, notes=data.notes)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _ser(row)


@router.put("/{cid}")
def update_cash(cid: int, data: CashIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(CashEntry).filter(CashEntry.id == cid).first()
    if not row:
        raise HTTPException(404, "Not found")
    bid = row.branch_id
    cash_sales = db.query(func.coalesce(func.sum(DailySales.cash), 0)).filter(
        DailySales.branch_id == bid, DailySales.date == data.date).scalar()
    cash_purchases = db.query(func.coalesce(func.sum(PurchaseOrder.total), 0)).filter(
        PurchaseOrder.branch_id == bid, PurchaseOrder.date == data.date,
        PurchaseOrder.payment_mode == "cash").scalar()
    cash_expenses = db.query(func.coalesce(func.sum(Expense.amount), 0)).filter(
        Expense.branch_id == bid, Expense.date == data.date,
        Expense.payment_mode == "cash").scalar()
    row.opening_balance = data.opening_balance
    row.cash_sales = float(cash_sales)
    row.cash_purchases = float(cash_purchases)
    row.cash_expenses = float(cash_expenses)
    row.deposited = data.deposited
    row.closing_balance = data.opening_balance + float(cash_sales) - float(cash_purchases) - float(cash_expenses) - data.deposited
    row.notes = data.notes
    row.date = data.date
    db.commit()
    db.refresh(row)
    return _ser(row)


@router.delete("/{cid}")
def delete_cash(cid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(CashEntry).filter(CashEntry.id == cid).first()
    if not row:
        raise HTTPException(404, "Not found")
    db.delete(row)
    db.commit()
    return {"ok": True}


def _ser(r):
    return {
        "id": r.id, "branch_id": r.branch_id, "date": str(r.date),
        "opening_balance": r.opening_balance, "cash_sales": r.cash_sales,
        "cash_purchases": r.cash_purchases, "cash_expenses": r.cash_expenses,
        "deposited": r.deposited, "closing_balance": r.closing_balance,
        "notes": r.notes,
    }
