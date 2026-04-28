from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from backend.database import get_db
from backend.models import DailySales, PurchaseOrder, Expense, Employee, CashEntry, Branch, User
from backend.auth import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(branch_id: Optional[int] = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    bid = user.branch_id if user.role == "branch_user" else branch_id

    def flt(q, model):
        if bid:
            return q.filter(model.branch_id == bid)
        return q

    total_sales = flt(db.query(func.coalesce(func.sum(DailySales.physical_total), 0)), DailySales).scalar()
    total_purchases = flt(db.query(func.coalesce(func.sum(PurchaseOrder.total), 0)), PurchaseOrder).scalar()
    total_expenses = flt(db.query(func.coalesce(func.sum(Expense.amount), 0)), Expense).scalar()
    employee_count = flt(db.query(func.count(Employee.id)), Employee).filter(Employee.status == "active").scalar()
    sales_count = flt(db.query(func.count(DailySales.id)), DailySales).scalar()

    branches = db.query(Branch).order_by(Branch.id).all()
    branch_summary = []
    for b in branches:
        bs = db.query(func.coalesce(func.sum(DailySales.physical_total), 0)).filter(DailySales.branch_id == b.id).scalar()
        bp = db.query(func.coalesce(func.sum(PurchaseOrder.total), 0)).filter(PurchaseOrder.branch_id == b.id).scalar()
        be = db.query(func.coalesce(func.sum(Expense.amount), 0)).filter(Expense.branch_id == b.id).scalar()
        branch_summary.append({
            "branch_id": b.id, "name": b.name, "name_ar": b.name_ar,
            "total_sales": float(bs), "total_purchases": float(bp), "total_expenses": float(be),
        })

    return {
        "total_sales": float(total_sales),
        "total_purchases": float(total_purchases),
        "total_expenses": float(total_expenses),
        "employee_count": employee_count,
        "sales_count": sales_count,
        "branch_summary": branch_summary,
    }
