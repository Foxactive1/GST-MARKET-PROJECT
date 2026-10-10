"""Tenant-scoped SQLAlchemy models for the GST Market database."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB

from . import db


def new_id():
    return str(uuid.uuid4())


_json_type = db.JSON().with_variant(JSONB, "postgresql")


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


class Category(db.Model):
    __tablename__ = "categories"
    id = db.Column(db.String(36), primary_key=True, default=new_id)
    store_id = db.Column(db.String(36), db.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    __table_args__ = (UniqueConstraint("store_id", "name", name="uq_categories_store_name"),)


class Supplier(db.Model):
    __tablename__ = "suppliers"
    id = db.Column(db.String(36), primary_key=True, default=new_id)
    store_id = db.Column(db.String(36), db.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True)
    nome = db.Column(db.String(160), nullable=False)
    cnpj = db.Column(db.String(24))
    phone = db.Column(db.String(40))
    email = db.Column(db.String(254))
    address = db.Column(db.Text)
    active = db.Column(db.Boolean, nullable=False, default=True)
    raw_data = db.Column(_json_type, nullable=False, default=dict)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))
    __table_args__ = (UniqueConstraint("store_id", "cnpj", name="uq_suppliers_store_cnpj"),)


class Client(db.Model):
    __tablename__ = "clients"
    id = db.Column(db.String(36), primary_key=True, default=new_id)
    store_id = db.Column(db.String(36), db.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True)
    nome = db.Column(db.String(160), nullable=False)
    cpf = db.Column(db.String(20))
    phone = db.Column(db.String(40))
    email = db.Column(db.String(254))
    birth_date = db.Column(db.Date)
    fidelity_code = db.Column(db.String(32))
    points = db.Column(db.Integer, nullable=False, default=0)
    total_purchases = db.Column(db.Numeric(14, 2), nullable=False, default=0)
    active = db.Column(db.Boolean, nullable=False, default=True)
    raw_data = db.Column(_json_type, nullable=False, default=dict)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))
    __table_args__ = (
        UniqueConstraint("store_id", "cpf", name="uq_clients_store_cpf"),
        UniqueConstraint("store_id", "fidelity_code", name="uq_clients_store_fidelity_code"),
    )


class Product(db.Model):
    __tablename__ = "products"
    id = db.Column(db.String(36), primary_key=True, default=new_id)
    store_id = db.Column(db.String(36), db.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True)
    code = db.Column(db.String(80))
    nome = db.Column(db.String(200), nullable=False)
    category_id = db.Column(db.String(36), db.ForeignKey("categories.id", ondelete="SET NULL"))
    categoria = db.Column(db.String(120))
    unit = db.Column(db.String(20), nullable=False, default="UN")
    preco = db.Column(db.Numeric(14, 2), nullable=False, default=0)
    cost = db.Column(db.Numeric(14, 2))
    qtd = db.Column(db.Numeric(14, 3), nullable=False, default=0)
    min_stock = db.Column(db.Numeric(14, 3), nullable=False, default=0)
    max_stock = db.Column(db.Numeric(14, 3))
    supplier_id = db.Column(db.String(36), db.ForeignKey("suppliers.id", ondelete="SET NULL"))
    expires_on = db.Column(db.Date)
    sold = db.Column(db.Numeric(14, 3), nullable=False, default=0)
    active = db.Column(db.Boolean, nullable=False, default=True)
    raw_data = db.Column(_json_type, nullable=False, default=dict)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))
    __table_args__ = (UniqueConstraint("store_id", "code", name="uq_products_store_code"),)


class Inventory(db.Model):
    __tablename__ = "inventory"
    store_id = db.Column(db.String(36), db.ForeignKey("stores.id", ondelete="CASCADE"), primary_key=True)
    product_id = db.Column(db.String(36), db.ForeignKey("products.id", ondelete="CASCADE"), primary_key=True)
    quantity = db.Column(db.Numeric(14, 3), nullable=False, default=0)
    min_stock = db.Column(db.Numeric(14, 3), nullable=False, default=0)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))


class CashierSession(db.Model):
    __tablename__ = "cashier_sessions"
    id = db.Column(db.String(100), primary_key=True)
    store_id = db.Column(db.String(36), db.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True)
    operator_name = db.Column(db.String(160))
    opening_balance = db.Column(db.Numeric(14, 2), nullable=False, default=0)
    closing_balance = db.Column(db.Numeric(14, 2))
    total_sales = db.Column(db.Numeric(14, 2), nullable=False, default=0)
    sales_count = db.Column(db.Integer, nullable=False, default=0)
    status = db.Column(db.String(20), nullable=False, default="aberto")
    opened_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    closed_at = db.Column(db.DateTime(timezone=True))
    raw_data = db.Column(_json_type, nullable=False, default=dict)


class Sale(db.Model):
    __tablename__ = "sales"
    id = db.Column(db.String(100), primary_key=True)
    store_id = db.Column(db.String(36), db.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id = db.Column(db.String(36), db.ForeignKey("clients.id", ondelete="SET NULL"))
    cashier_session_id = db.Column(db.String(100), db.ForeignKey("cashier_sessions.id", ondelete="SET NULL"))
    operator_name = db.Column(db.String(160))
    sold_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    subtotal = db.Column(db.Numeric(14, 2), nullable=False, default=0)
    discount = db.Column(db.Numeric(14, 2), nullable=False, default=0)
    total = db.Column(db.Numeric(14, 2), nullable=False, default=0)
    payment_method = db.Column(db.String(40))
    amount_paid = db.Column(db.Numeric(14, 2))
    change_amount = db.Column(db.Numeric(14, 2))
    status = db.Column(db.String(20), nullable=False, default="concluida")
    notes = db.Column(db.Text)
    raw_data = db.Column(_json_type, nullable=False, default=dict)


class SaleItem(db.Model):
    __tablename__ = "sale_items"
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    store_id = db.Column(db.String(36), db.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    sale_id = db.Column(db.String(100), db.ForeignKey("sales.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = db.Column(db.String(36), db.ForeignKey("products.id", ondelete="SET NULL"))
    product_name = db.Column(db.String(200), nullable=False)
    product_code = db.Column(db.String(80))
    quantity = db.Column(db.Numeric(14, 3), nullable=False)
    unit_price = db.Column(db.Numeric(14, 2), nullable=False)
    discount = db.Column(db.Numeric(14, 2), nullable=False, default=0)
    line_total = db.Column(db.Numeric(14, 2), nullable=False)
    raw_data = db.Column(_json_type, nullable=False, default=dict)


class StockMovement(db.Model):
    __tablename__ = "stock_movements"
    id = db.Column(db.String(100), primary_key=True)
    store_id = db.Column(db.String(36), db.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = db.Column(db.String(36), db.ForeignKey("products.id", ondelete="SET NULL"))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="SET NULL"))
    movement_type = db.Column(db.String(24), nullable=False)
    quantity = db.Column(db.Numeric(14, 3), nullable=False)
    unit_cost = db.Column(db.Numeric(14, 2))
    reason = db.Column(db.String(160))
    reference = db.Column(db.String(100))
    occurred_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    raw_data = db.Column(_json_type, nullable=False, default=dict)


class FidelityConfig(db.Model):
    __tablename__ = "fidelity_config"
    store_id = db.Column(db.String(36), db.ForeignKey("stores.id", ondelete="CASCADE"), primary_key=True)
    enabled = db.Column(db.Boolean, nullable=False, default=True)
    points_rate = db.Column(db.Numeric(12, 4), nullable=False, default=1)
    signup_bonus = db.Column(db.Integer, nullable=False, default=0)
    discount_points = db.Column(db.Integer, nullable=False, default=100)
    discount_value = db.Column(db.Numeric(12, 2), nullable=False, default=5)
    expiry_days = db.Column(db.Integer, nullable=False, default=365)
    birthday_bonus = db.Column(db.Boolean, nullable=False, default=False)
    first_purchase_bonus = db.Column(db.Boolean, nullable=False, default=False)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))


class FidelityTransaction(db.Model):
    __tablename__ = "fidelity_transactions"
    id = db.Column(db.String(100), primary_key=True)
    store_id = db.Column(db.String(36), db.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id = db.Column(db.String(36), db.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)
    sale_id = db.Column(db.String(100), db.ForeignKey("sales.id", ondelete="SET NULL"))
    transaction_type = db.Column(db.String(24), nullable=False)
    points = db.Column(db.Integer, nullable=False)
    description = db.Column(db.String(240))
    expires_at = db.Column(db.DateTime(timezone=True))
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    raw_data = db.Column(_json_type, nullable=False, default=dict)


class PurchaseOrder(db.Model):
    __tablename__ = "purchase_orders"
    id = db.Column(db.String(100), primary_key=True)
    store_id = db.Column(db.String(36), db.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True)
    supplier_id = db.Column(db.String(36), db.ForeignKey("suppliers.id", ondelete="SET NULL"))
    number = db.Column(db.String(40), nullable=False)
    status = db.Column(db.String(24), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    sent_at = db.Column(db.DateTime(timezone=True))
    expected_at = db.Column(db.DateTime(timezone=True))
    received_at = db.Column(db.DateTime(timezone=True))
    estimated_total = db.Column(db.Numeric(14, 2), nullable=False, default=0)
    received_total = db.Column(db.Numeric(14, 2), nullable=False, default=0)
    notes = db.Column(db.Text)
    raw_data = db.Column(_json_type, nullable=False, default=dict)
    __table_args__ = (UniqueConstraint("store_id", "number", name="uq_purchase_orders_store_number"),)


class PurchaseOrderItem(db.Model):
    __tablename__ = "purchase_order_items"
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    store_id = db.Column(db.String(36), db.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    purchase_order_id = db.Column(db.String(100), db.ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = db.Column(db.String(36), db.ForeignKey("products.id", ondelete="SET NULL"))
    product_name = db.Column(db.String(200), nullable=False)
    unit = db.Column(db.String(20))
    quantity_ordered = db.Column(db.Numeric(14, 3), nullable=False)
    quantity_received = db.Column(db.Numeric(14, 3), nullable=False, default=0)
    unit_cost = db.Column(db.Numeric(14, 2), nullable=False)
    suggested_price = db.Column(db.Numeric(14, 2))
    raw_data = db.Column(_json_type, nullable=False, default=dict)


class PriceHistory(db.Model):
    __tablename__ = "price_history"
    id = db.Column(db.String(100), primary_key=True)
    store_id = db.Column(db.String(36), db.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = db.Column(db.String(36), db.ForeignKey("products.id", ondelete="SET NULL"), index=True)
    product_name = db.Column(db.String(200), nullable=False)
    price = db.Column(db.Numeric(14, 2), nullable=False)
    source = db.Column(db.String(160))
    observed_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    raw_data = db.Column(_json_type, nullable=False, default=dict)


class StoreState(db.Model):
    __tablename__ = "store_state"
    store_id = db.Column(db.String(36), db.ForeignKey("stores.id", ondelete="CASCADE"), primary_key=True)
    payload = db.Column(_json_type, nullable=False)
    version = db.Column(db.Integer, nullable=False, default=1)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))
