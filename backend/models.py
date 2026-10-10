"""Tenant-scoped tables used by the GST Market API."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB

from . import db


def new_id():
    return str(uuid.uuid4())


class Store(db.Model):
    __tablename__ = "stores"
    id = db.Column(db.String(36), primary_key=True, default=new_id)
    name = db.Column(db.String(160), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.String(36), primary_key=True, default=new_id)
    store_id = db.Column(db.String(36), db.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True)
    username = db.Column(db.String(80), nullable=False)
    name = db.Column(db.String(160), nullable=False)
    email = db.Column(db.String(254))
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="operador")
    active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    __table_args__ = (UniqueConstraint("store_id", "username", name="uq_users_store_username"),)


_json_type = db.JSON().with_variant(JSONB, "postgresql")


class StoreState(db.Model):
    __tablename__ = "store_state"
    store_id = db.Column(db.String(36), db.ForeignKey("stores.id", ondelete="CASCADE"), primary_key=True)
    payload = db.Column(_json_type, nullable=False)
    version = db.Column(db.Integer, nullable=False, default=1)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False,
                           default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))
