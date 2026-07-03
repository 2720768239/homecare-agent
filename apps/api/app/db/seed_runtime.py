from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import DeviceModel
from app.db.repositories.seed_repository import insert_seed_dataset


def seed_if_empty(db: Session) -> None:
    count = db.execute(select(func.count()).select_from(DeviceModel)).scalar_one()
    if count == 0:
        insert_seed_dataset(db)
        db.commit()


def main() -> None:
    from app.db.database import SessionLocal

    with SessionLocal() as db:
        seed_if_empty(db)
        print("Seed complete.")


if __name__ == "__main__":
    main()
