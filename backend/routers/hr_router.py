from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date
from backend.database import get_db
from backend.models import Employee, User
from backend.auth import get_current_user

router = APIRouter(prefix="/api/hr", tags=["hr"])


class EmployeeIn(BaseModel):
    branch_id: int
    name: str
    name_ar: str = ""
    civil_id: str = ""
    mobile: str = ""
    position: str = ""
    nationality: str = ""
    salary: float = 0
    join_date: Optional[date] = None
    status: str = "active"
    notes: str = ""
    attachment: str = ""

    @field_validator("civil_id")
    @classmethod
    def validate_civil_id(cls, v):
        if v and (len(v) != 12 or not v.isdigit()):
            raise ValueError("Civil ID must be exactly 12 digits")
        return v

    @field_validator("mobile")
    @classmethod
    def validate_mobile(cls, v):
        if v and (len(v) != 8 or not v.isdigit()):
            raise ValueError("Mobile must be exactly 8 digits")
        return v


@router.get("")
def list_employees(branch_id: Optional[int] = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    bid = user.branch_id if user.role == "branch_user" else branch_id
    q = db.query(Employee)
    if bid:
        q = q.filter(Employee.branch_id == bid)
    return [_ser(r) for r in q.order_by(Employee.name).all()]


@router.post("")
def create_employee(data: EmployeeIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    bid = user.branch_id if user.role == "branch_user" else data.branch_id
    row = Employee(branch_id=bid, name=data.name, name_ar=data.name_ar,
                   civil_id=data.civil_id, mobile=data.mobile,
                   position=data.position, nationality=data.nationality,
                   salary=data.salary, join_date=data.join_date,
                   status=data.status, notes=data.notes, attachment=data.attachment)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _ser(row)


@router.put("/{emp_id}")
def update_employee(emp_id: int, data: EmployeeIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(Employee).filter(Employee.id == emp_id).first()
    if not row:
        raise HTTPException(404, "Not found")
    for k, v in data.dict().items():
        if k != "branch_id":
            setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return _ser(row)


@router.delete("/{emp_id}")
def delete_employee(emp_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(Employee).filter(Employee.id == emp_id).first()
    if not row:
        raise HTTPException(404, "Not found")
    db.delete(row)
    db.commit()
    return {"ok": True}


def _ser(r):
    return {
        "id": r.id, "branch_id": r.branch_id, "name": r.name, "name_ar": r.name_ar,
        "civil_id": r.civil_id, "mobile": r.mobile, "position": r.position,
        "nationality": r.nationality, "salary": r.salary,
        "join_date": str(r.join_date) if r.join_date else None,
        "status": r.status, "notes": r.notes, "attachment": r.attachment,
    }
