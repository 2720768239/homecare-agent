"""Attachment routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.store import store
from app.schemas import (
    Attachment,
    RegisterAttachmentRequest,
    UpdateParseStatusRequest,
)

router = APIRouter(prefix="/attachments", tags=["attachments"])


@router.post("", response_model=Attachment, status_code=201)
def register_attachment(
    req: RegisterAttachmentRequest, userId: str = "user_home_a", db: Session = Depends(get_db)
):
    return store.register_attachment(
        db,
        {
            "filename": req.filename,
            "mimeType": req.mimeType,
            "sizeBytes": req.sizeBytes,
            "attachmentType": req.attachmentType,
        },
        userId,
    )


@router.get("/{att_id}", response_model=Attachment)
def get_attachment(att_id: str, db: Session = Depends(get_db)):
    a = store.get_attachment(db, att_id)
    if not a:
        raise HTTPException(status_code=404, detail="Attachment not found")
    return a


@router.get("/by-device/{device_id}", response_model=list[Attachment])
def list_attachments_by_device(device_id: str, db: Session = Depends(get_db)):
    return store.list_attachments_by_device(db, device_id)


@router.post("/{att_id}/parse", response_model=Attachment)
def parse_attachment(att_id: str, db: Session = Depends(get_db)):
    try:
        return store.parse_attachment(db, att_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Attachment not found")


@router.patch("/{att_id}/status", response_model=Attachment)
def update_parse_status(att_id: str, req: UpdateParseStatusRequest, db: Session = Depends(get_db)):
    a = store.set_attachment_parse_status(db, att_id, req.parseStatus, req.parseError)
    if not a:
        raise HTTPException(status_code=404, detail="Attachment not found")
    return a
