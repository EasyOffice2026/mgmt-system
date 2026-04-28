from backend.database import engine, SessionLocal, Base
from backend.models import Branch, User
from backend.auth import hash_password


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    if db.query(Branch).count() > 0:
        db.close()
        return

    branches = [
        Branch(name="Al Aqeelah", name_ar="\u0627\u0644\u0639\u0642\u064a\u0644\u0629", is_kitchen=False),
        Branch(name="Al Aradiya", name_ar="\u0627\u0644\u0639\u0627\u0631\u0636\u064a\u0629", is_kitchen=False),
        Branch(name="Al Jahra", name_ar="\u0627\u0644\u062c\u0647\u0631\u0627\u0621", is_kitchen=False),
        Branch(name="Al Ayoun", name_ar="\u0627\u0644\u0639\u064a\u0648\u0646", is_kitchen=False),
        Branch(name="Central Kitchen", name_ar="\u0627\u0644\u0645\u0637\u0628\u062e \u0627\u0644\u0645\u0631\u0643\u0632\u064a", is_kitchen=True),
    ]
    db.add_all(branches)
    db.flush()

    users = [
        User(username="owner", password_hash=hash_password("owner123"), full_name="Owner", role="owner", branch_id=None),
        User(username="manager", password_hash=hash_password("manager123"), full_name="Manager", role="manager", branch_id=None),
        User(username="aqeelah", password_hash=hash_password("aqeelah123"), full_name="Al Aqeelah User", role="branch_user", branch_id=branches[0].id),
        User(username="aradiya", password_hash=hash_password("aradiya123"), full_name="Al Aradiya User", role="branch_user", branch_id=branches[1].id),
        User(username="jahra", password_hash=hash_password("jahra123"), full_name="Al Jahra User", role="branch_user", branch_id=branches[2].id),
        User(username="ayoun", password_hash=hash_password("ayoun123"), full_name="Al Ayoun User", role="branch_user", branch_id=branches[3].id),
        User(username="kitchen", password_hash=hash_password("kitchen123"), full_name="Kitchen User", role="branch_user", branch_id=branches[4].id),
    ]
    db.add_all(users)
    db.commit()
    db.close()
    print("Database seeded successfully")
