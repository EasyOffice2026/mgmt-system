import datetime
from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from backend.database import Base


class Branch(Base):
    __tablename__ = "branches"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    name_ar = Column(String(100), nullable=False)
    is_kitchen = Column(Boolean, default=False)
    users = relationship("User", back_populates="branch")


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String(256), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(20), nullable=False)  # owner, manager, branch_user
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    branch = relationship("Branch", back_populates="users")


class DailySales(Base):
    __tablename__ = "daily_sales"
    id = Column(Integer, primary_key=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    date = Column(Date, nullable=False)
    cash = Column(Float, default=0)
    knet = Column(Float, default=0)
    link = Column(Float, default=0)
    wamd = Column(Float, default=0)
    talabat = Column(Float, default=0)
    jahez = Column(Float, default=0)
    keeta = Column(Float, default=0)
    foodics_total = Column(Float, default=0)
    physical_total = Column(Float, default=0)
    difference = Column(Float, default=0)
    notes = Column(Text, default="")
    attachment = Column(String(500), default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    branch = relationship("Branch")


class Item(Base):
    __tablename__ = "items"
    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    name_ar = Column(String(200), default="")
    unit_price = Column(Float, default=0)
    unit = Column(String(50), default="piece")
    category = Column(String(100), default="")


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    id = Column(Integer, primary_key=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    date = Column(Date, nullable=False)
    supplier = Column(String(200), default="")
    item_id = Column(Integer, ForeignKey("items.id"), nullable=True)
    item_name = Column(String(200), default="")
    quantity = Column(Float, default=0)
    unit_price = Column(Float, default=0)
    total = Column(Float, default=0)
    payment_mode = Column(String(50), default="cash")
    notes = Column(Text, default="")
    attachment = Column(String(500), default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    branch = relationship("Branch")
    item = relationship("Item")


class Expense(Base):
    __tablename__ = "expenses"
    id = Column(Integer, primary_key=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    date = Column(Date, nullable=False)
    category = Column(String(100), default="")
    description = Column(String(500), default="")
    amount = Column(Float, default=0)
    payment_mode = Column(String(50), default="cash")
    notes = Column(Text, default="")
    attachment = Column(String(500), default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    branch = relationship("Branch")


class Employee(Base):
    __tablename__ = "employees"
    id = Column(Integer, primary_key=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    name = Column(String(200), nullable=False)
    name_ar = Column(String(200), default="")
    civil_id = Column(String(12), default="")
    mobile = Column(String(8), default="")
    position = Column(String(100), default="")
    nationality = Column(String(100), default="")
    salary = Column(Float, default=0)
    join_date = Column(Date, nullable=True)
    status = Column(String(20), default="active")
    notes = Column(Text, default="")
    attachment = Column(String(500), default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    branch = relationship("Branch")


class CashEntry(Base):
    __tablename__ = "cash_entries"
    id = Column(Integer, primary_key=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    date = Column(Date, nullable=False)
    opening_balance = Column(Float, default=0)
    cash_sales = Column(Float, default=0)
    cash_purchases = Column(Float, default=0)
    cash_expenses = Column(Float, default=0)
    deposited = Column(Float, default=0)
    closing_balance = Column(Float, default=0)
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    branch = relationship("Branch")
