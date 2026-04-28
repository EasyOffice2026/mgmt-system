import io
import csv
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from openpyxl import Workbook
from reportlab.lib.pagesizes import landscape, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors
from backend.database import get_db
from backend.models import DailySales, PurchaseOrder, Expense, Employee, CashEntry, User
from backend.auth import get_current_user

router = APIRouter(prefix="/api/export", tags=["export"])

SALES_COLS = ["Date", "Cash", "KNET", "Link", "WAMD", "Talabat", "Jahez", "KEETA", "Physical Total", "Foodics Total", "Difference"]
PURCHASE_COLS = ["Date", "Supplier", "Item", "Qty", "Unit Price", "Total", "Payment"]
EXPENSE_COLS = ["Date", "Category", "Description", "Amount", "Payment"]
HR_COLS = ["Name", "Civil ID", "Mobile", "Position", "Nationality", "Salary", "Status"]
CASH_COLS = ["Date", "Opening", "Cash Sales", "Cash Purchases", "Cash Expenses", "Deposited", "Closing"]


def _get_sales_rows(db, bid):
    q = db.query(DailySales)
    if bid:
        q = q.filter(DailySales.branch_id == bid)
    return [[str(r.date), r.cash, r.knet, r.link, r.wamd, r.talabat, r.jahez, r.keeta,
             r.physical_total, r.foodics_total, r.difference] for r in q.order_by(DailySales.date.desc()).all()]


def _get_purchase_rows(db, bid):
    q = db.query(PurchaseOrder)
    if bid:
        q = q.filter(PurchaseOrder.branch_id == bid)
    return [[str(r.date), r.supplier, r.item_name, r.quantity, r.unit_price, r.total, r.payment_mode]
            for r in q.order_by(PurchaseOrder.date.desc()).all()]


def _get_expense_rows(db, bid):
    q = db.query(Expense)
    if bid:
        q = q.filter(Expense.branch_id == bid)
    return [[str(r.date), r.category, r.description, r.amount, r.payment_mode]
            for r in q.order_by(Expense.date.desc()).all()]


def _get_hr_rows(db, bid):
    q = db.query(Employee)
    if bid:
        q = q.filter(Employee.branch_id == bid)
    return [[r.name, r.civil_id, r.mobile, r.position, r.nationality, r.salary, r.status]
            for r in q.order_by(Employee.name).all()]


def _get_cash_rows(db, bid):
    q = db.query(CashEntry)
    if bid:
        q = q.filter(CashEntry.branch_id == bid)
    return [[str(r.date), r.opening_balance, r.cash_sales, r.cash_purchases, r.cash_expenses,
             r.deposited, r.closing_balance] for r in q.order_by(CashEntry.date.desc()).all()]


MODULE_MAP = {
    "sales": (SALES_COLS, _get_sales_rows),
    "purchases": (PURCHASE_COLS, _get_purchase_rows),
    "expenses": (EXPENSE_COLS, _get_expense_rows),
    "hr": (HR_COLS, _get_hr_rows),
    "cash": (CASH_COLS, _get_cash_rows),
}


@router.get("/{module}/csv")
def export_csv(module: str, branch_id: Optional[int] = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    bid = user.branch_id if user.role == "branch_user" else branch_id
    cols, getter = MODULE_MAP[module]
    rows = getter(db, bid)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(cols)
    w.writerows(rows)
    buf.seek(0)
    return StreamingResponse(io.BytesIO(buf.getvalue().encode()), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename={module}.csv"})


@router.get("/{module}/excel")
def export_excel(module: str, branch_id: Optional[int] = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    bid = user.branch_id if user.role == "branch_user" else branch_id
    cols, getter = MODULE_MAP[module]
    rows = getter(db, bid)
    wb = Workbook()
    ws = wb.active
    ws.title = module.title()
    ws.append(cols)
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": f"attachment; filename={module}.xlsx"})


@router.get("/{module}/pdf")
def export_pdf(module: str, branch_id: Optional[int] = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    bid = user.branch_id if user.role == "branch_user" else branch_id
    cols, getter = MODULE_MAP[module]
    rows = getter(db, bid)
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4))
    styles = getSampleStyleSheet()
    elements = [Paragraph(f"Mudawwarah - {module.title()}", styles["Title"])]
    table_data = [cols] + rows
    t = Table(table_data)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a3a5c")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.white]),
    ]))
    elements.append(t)
    doc.build(elements)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": f"attachment; filename={module}.pdf"})
