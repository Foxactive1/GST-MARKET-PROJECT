"""Retail domain tables for clients, stock, sales, loyalty, suppliers and purchasing.

Revision ID: 0002_retail_tables
Revises: 0001_initial
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0002_retail_tables"
down_revision = "0001_initial"
branch_labels = None
depends_on = None
JSON_TYPE = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def _raw():
    return sa.Column("raw_data", JSON_TYPE, nullable=False)


def upgrade():
    op.create_table(
        "categories",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("store_id", sa.String(36), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("store_id", "name", name="uq_categories_store_name"),
    )
    op.create_index("ix_categories_store_id", "categories", ["store_id"])

    op.create_table(
        "suppliers",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("store_id", sa.String(36), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("nome", sa.String(160), nullable=False),
        sa.Column("cnpj", sa.String(24)),
        sa.Column("phone", sa.String(40)),
        sa.Column("email", sa.String(254)),
        sa.Column("address", sa.Text()),
        sa.Column("active", sa.Boolean(), nullable=False),
        _raw(),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("store_id", "cnpj", name="uq_suppliers_store_cnpj"),
    )
    op.create_index("ix_suppliers_store_id", "suppliers", ["store_id"])

    op.create_table(
        "clients",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("store_id", sa.String(36), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("nome", sa.String(160), nullable=False),
        sa.Column("cpf", sa.String(20)),
        sa.Column("phone", sa.String(40)),
        sa.Column("email", sa.String(254)),
        sa.Column("birth_date", sa.Date()),
        sa.Column("fidelity_code", sa.String(32)),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("total_purchases", sa.Numeric(14, 2), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        _raw(),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("store_id", "cpf", name="uq_clients_store_cpf"),
        sa.UniqueConstraint("store_id", "fidelity_code", name="uq_clients_store_fidelity_code"),
    )
    op.create_index("ix_clients_store_id", "clients", ["store_id"])
    op.create_index("ix_clients_store_nome", "clients", ["store_id", "nome"])

    op.create_table(
        "products",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("store_id", sa.String(36), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code", sa.String(80)),
        sa.Column("nome", sa.String(200), nullable=False),
        sa.Column("category_id", sa.String(36), sa.ForeignKey("categories.id", ondelete="SET NULL")),
        sa.Column("categoria", sa.String(120)),
        sa.Column("unit", sa.String(20), nullable=False),
        sa.Column("preco", sa.Numeric(14, 2), nullable=False),
        sa.Column("cost", sa.Numeric(14, 2)),
        sa.Column("qtd", sa.Numeric(14, 3), nullable=False),
        sa.Column("min_stock", sa.Numeric(14, 3), nullable=False),
        sa.Column("max_stock", sa.Numeric(14, 3)),
        sa.Column("supplier_id", sa.String(36), sa.ForeignKey("suppliers.id", ondelete="SET NULL")),
        sa.Column("expires_on", sa.Date()),
        sa.Column("sold", sa.Numeric(14, 3), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        _raw(),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("store_id", "code", name="uq_products_store_code"),
    )
    op.create_index("ix_products_store_id", "products", ["store_id"])
    op.create_index("ix_products_store_nome", "products", ["store_id", "nome"])
    op.create_index("ix_products_store_supplier", "products", ["store_id", "supplier_id"])

    op.create_table(
        "inventory",
        sa.Column("store_id", sa.String(36), sa.ForeignKey("stores.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("product_id", sa.String(36), sa.ForeignKey("products.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False),
        sa.Column("min_stock", sa.Numeric(14, 3), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_inventory_store_quantity", "inventory", ["store_id", "quantity"])

    op.create_table(
        "cashier_sessions",
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("store_id", sa.String(36), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("operator_name", sa.String(160)),
        sa.Column("opening_balance", sa.Numeric(14, 2), nullable=False),
        sa.Column("closing_balance", sa.Numeric(14, 2)),
        sa.Column("total_sales", sa.Numeric(14, 2), nullable=False),
        sa.Column("sales_count", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True)),
        _raw(),
    )
    op.create_index("ix_cashier_sessions_store_status", "cashier_sessions", ["store_id", "status"])

    op.create_table(
        "sales",
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("store_id", sa.String(36), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", sa.String(36), sa.ForeignKey("clients.id", ondelete="SET NULL")),
        sa.Column("cashier_session_id", sa.String(100), sa.ForeignKey("cashier_sessions.id", ondelete="SET NULL")),
        sa.Column("operator_name", sa.String(160)),
        sa.Column("sold_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("subtotal", sa.Numeric(14, 2), nullable=False),
        sa.Column("discount", sa.Numeric(14, 2), nullable=False),
        sa.Column("total", sa.Numeric(14, 2), nullable=False),
        sa.Column("payment_method", sa.String(40)),
        sa.Column("amount_paid", sa.Numeric(14, 2)),
        sa.Column("change_amount", sa.Numeric(14, 2)),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("notes", sa.Text()),
        _raw(),
    )
    op.create_index("ix_sales_store_id", "sales", ["store_id"])
    op.create_index("ix_sales_store_sold_at", "sales", ["store_id", "sold_at"])
    op.create_index("ix_sales_store_client", "sales", ["store_id", "client_id"])

    op.create_table(
        "sale_items",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("store_id", sa.String(36), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sale_id", sa.String(100), sa.ForeignKey("sales.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", sa.String(36), sa.ForeignKey("products.id", ondelete="SET NULL")),
        sa.Column("product_name", sa.String(200), nullable=False),
        sa.Column("product_code", sa.String(80)),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False),
        sa.Column("unit_price", sa.Numeric(14, 2), nullable=False),
        sa.Column("discount", sa.Numeric(14, 2), nullable=False),
        sa.Column("line_total", sa.Numeric(14, 2), nullable=False),
        _raw(),
    )
    op.create_index("ix_sale_items_sale_id", "sale_items", ["sale_id"])
    op.create_index("ix_sale_items_store_sale", "sale_items", ["store_id", "sale_id"])
    op.create_index("ix_sale_items_product", "sale_items", ["store_id", "product_id"])

    op.create_table(
        "stock_movements",
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("store_id", sa.String(36), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", sa.String(36), sa.ForeignKey("products.id", ondelete="SET NULL")),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("movement_type", sa.String(24), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False),
        sa.Column("unit_cost", sa.Numeric(14, 2)),
        sa.Column("reason", sa.String(160)),
        sa.Column("reference", sa.String(100)),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        _raw(),
    )
    op.create_index("ix_stock_movements_store_id", "stock_movements", ["store_id"])
    op.create_index("ix_stock_movements_store_date", "stock_movements", ["store_id", "occurred_at"])
    op.create_index("ix_stock_movements_product_date", "stock_movements", ["store_id", "product_id", "occurred_at"])

    op.create_table(
        "fidelity_config",
        sa.Column("store_id", sa.String(36), sa.ForeignKey("stores.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("points_rate", sa.Numeric(12, 4), nullable=False),
        sa.Column("signup_bonus", sa.Integer(), nullable=False),
        sa.Column("discount_points", sa.Integer(), nullable=False),
        sa.Column("discount_value", sa.Numeric(12, 2), nullable=False),
        sa.Column("expiry_days", sa.Integer(), nullable=False),
        sa.Column("birthday_bonus", sa.Boolean(), nullable=False),
        sa.Column("first_purchase_bonus", sa.Boolean(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "fidelity_transactions",
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("store_id", sa.String(36), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", sa.String(36), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sale_id", sa.String(100), sa.ForeignKey("sales.id", ondelete="SET NULL")),
        sa.Column("transaction_type", sa.String(24), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("description", sa.String(240)),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        _raw(),
    )
    op.create_index("ix_fidelity_transactions_store_id", "fidelity_transactions", ["store_id"])
    op.create_index("ix_fidelity_transactions_client_id", "fidelity_transactions", ["client_id"])
    op.create_index("ix_fidelity_transactions_client", "fidelity_transactions", ["store_id", "client_id", "created_at"])

    op.create_table(
        "purchase_orders",
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("store_id", sa.String(36), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("supplier_id", sa.String(36), sa.ForeignKey("suppliers.id", ondelete="SET NULL")),
        sa.Column("number", sa.String(40), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True)),
        sa.Column("expected_at", sa.DateTime(timezone=True)),
        sa.Column("received_at", sa.DateTime(timezone=True)),
        sa.Column("estimated_total", sa.Numeric(14, 2), nullable=False),
        sa.Column("received_total", sa.Numeric(14, 2), nullable=False),
        sa.Column("notes", sa.Text()),
        _raw(),
        sa.UniqueConstraint("store_id", "number", name="uq_purchase_orders_store_number"),
    )
    op.create_index("ix_purchase_orders_store_id", "purchase_orders", ["store_id"])
    op.create_index("ix_purchase_orders_store_status", "purchase_orders", ["store_id", "status", "created_at"])

    op.create_table(
        "purchase_order_items",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("store_id", sa.String(36), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("purchase_order_id", sa.String(100), sa.ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", sa.String(36), sa.ForeignKey("products.id", ondelete="SET NULL")),
        sa.Column("product_name", sa.String(200), nullable=False),
        sa.Column("unit", sa.String(20)),
        sa.Column("quantity_ordered", sa.Numeric(14, 3), nullable=False),
        sa.Column("quantity_received", sa.Numeric(14, 3), nullable=False),
        sa.Column("unit_cost", sa.Numeric(14, 2), nullable=False),
        sa.Column("suggested_price", sa.Numeric(14, 2)),
        _raw(),
    )
    op.create_index("ix_purchase_order_items_purchase_order_id", "purchase_order_items", ["purchase_order_id"])
    op.create_index("ix_purchase_order_items_order", "purchase_order_items", ["store_id", "purchase_order_id"])

    op.create_table(
        "price_history",
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("store_id", sa.String(36), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", sa.String(36), sa.ForeignKey("products.id", ondelete="SET NULL")),
        sa.Column("product_name", sa.String(200), nullable=False),
        sa.Column("price", sa.Numeric(14, 2), nullable=False),
        sa.Column("source", sa.String(160)),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        _raw(),
    )
    op.create_index("ix_price_history_store_id", "price_history", ["store_id"])
    op.create_index("ix_price_history_product_id", "price_history", ["product_id"])
    op.create_index("ix_price_history_store_product_date", "price_history", ["store_id", "product_id", "observed_at"])


def downgrade():
    op.drop_table("price_history")
    op.drop_table("purchase_order_items")
    op.drop_table("purchase_orders")
    op.drop_table("fidelity_transactions")
    op.drop_table("fidelity_config")
    op.drop_table("stock_movements")
    op.drop_table("sale_items")
    op.drop_table("sales")
    op.drop_table("cashier_sessions")
    op.drop_table("inventory")
    op.drop_table("products")
    op.drop_table("clients")
    op.drop_table("suppliers")
    op.drop_table("categories")
