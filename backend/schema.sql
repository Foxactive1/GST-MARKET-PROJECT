-- GST Market — schema operacional PostgreSQL/Neon
-- Execute em um banco Neon novo. Cria o esquema operacional e registra a revisão 0002.
BEGIN;

CREATE TABLE IF NOT EXISTS stores (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  store_id VARCHAR(36) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  username VARCHAR(80) NOT NULL,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(254),
  password_hash VARCHAR(256) NOT NULL,
  role VARCHAR(20) NOT NULL,
  active BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_users_store_username UNIQUE (store_id, username)
);
CREATE INDEX IF NOT EXISTS ix_users_store_id ON users (store_id);

CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(36) PRIMARY KEY,
  store_id VARCHAR(36) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_categories_store_name UNIQUE (store_id, name)
);
CREATE INDEX IF NOT EXISTS ix_categories_store_id ON categories (store_id);

CREATE TABLE IF NOT EXISTS suppliers (
  id VARCHAR(36) PRIMARY KEY,
  store_id VARCHAR(36) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  nome VARCHAR(160) NOT NULL,
  cnpj VARCHAR(24),
  phone VARCHAR(40),
  email VARCHAR(254),
  address TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_suppliers_store_cnpj UNIQUE (store_id, cnpj)
);
CREATE INDEX IF NOT EXISTS ix_suppliers_store_id ON suppliers (store_id);

CREATE TABLE IF NOT EXISTS clients (
  id VARCHAR(36) PRIMARY KEY,
  store_id VARCHAR(36) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  nome VARCHAR(160) NOT NULL,
  cpf VARCHAR(20),
  phone VARCHAR(40),
  email VARCHAR(254),
  birth_date DATE,
  fidelity_code VARCHAR(32),
  points INTEGER NOT NULL DEFAULT 0,
  total_purchases NUMERIC(14,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_clients_store_cpf UNIQUE (store_id, cpf),
  CONSTRAINT uq_clients_store_fidelity_code UNIQUE (store_id, fidelity_code)
);
CREATE INDEX IF NOT EXISTS ix_clients_store_id ON clients (store_id);
CREATE INDEX IF NOT EXISTS ix_clients_store_nome ON clients (store_id, nome);

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(36) PRIMARY KEY,
  store_id VARCHAR(36) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  code VARCHAR(80),
  nome VARCHAR(200) NOT NULL,
  category_id VARCHAR(36) REFERENCES categories(id) ON DELETE SET NULL,
  categoria VARCHAR(120),
  unit VARCHAR(20) NOT NULL DEFAULT 'UN',
  preco NUMERIC(14,2) NOT NULL DEFAULT 0,
  cost NUMERIC(14,2),
  qtd NUMERIC(14,3) NOT NULL DEFAULT 0,
  min_stock NUMERIC(14,3) NOT NULL DEFAULT 0,
  max_stock NUMERIC(14,3),
  supplier_id VARCHAR(36) REFERENCES suppliers(id) ON DELETE SET NULL,
  expires_on DATE,
  sold NUMERIC(14,3) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_products_store_code UNIQUE (store_id, code)
);
CREATE INDEX IF NOT EXISTS ix_products_store_id ON products (store_id);
CREATE INDEX IF NOT EXISTS ix_products_store_nome ON products (store_id, nome);
CREATE INDEX IF NOT EXISTS ix_products_store_supplier ON products (store_id, supplier_id);

CREATE TABLE IF NOT EXISTS inventory (
  store_id VARCHAR(36) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id VARCHAR(36) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  min_stock NUMERIC(14,3) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (store_id, product_id)
);
CREATE INDEX IF NOT EXISTS ix_inventory_store_quantity ON inventory (store_id, quantity);

CREATE TABLE IF NOT EXISTS cashier_sessions (
  id VARCHAR(100) PRIMARY KEY,
  store_id VARCHAR(36) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  operator_name VARCHAR(160),
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(14,2),
  total_sales NUMERIC(14,2) NOT NULL DEFAULT 0,
  sales_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'aberto',
  opened_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS ix_cashier_sessions_store_id ON cashier_sessions (store_id);
CREATE INDEX IF NOT EXISTS ix_cashier_sessions_store_status ON cashier_sessions (store_id, status);

CREATE TABLE IF NOT EXISTS sales (
  id VARCHAR(100) PRIMARY KEY,
  store_id VARCHAR(36) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  client_id VARCHAR(36) REFERENCES clients(id) ON DELETE SET NULL,
  cashier_session_id VARCHAR(100) REFERENCES cashier_sessions(id) ON DELETE SET NULL,
  operator_name VARCHAR(160),
  sold_at TIMESTAMPTZ NOT NULL,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(40),
  amount_paid NUMERIC(14,2),
  change_amount NUMERIC(14,2),
  status VARCHAR(20) NOT NULL DEFAULT 'concluida',
  notes TEXT,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS ix_sales_store_id ON sales (store_id);
CREATE INDEX IF NOT EXISTS ix_sales_store_sold_at ON sales (store_id, sold_at);
CREATE INDEX IF NOT EXISTS ix_sales_store_client ON sales (store_id, client_id);

CREATE TABLE IF NOT EXISTS sale_items (
  id BIGSERIAL PRIMARY KEY,
  store_id VARCHAR(36) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  sale_id VARCHAR(100) NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id VARCHAR(36) REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(200) NOT NULL,
  product_code VARCHAR(80),
  quantity NUMERIC(14,3) NOT NULL,
  unit_price NUMERIC(14,2) NOT NULL,
  discount NUMERIC(14,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(14,2) NOT NULL,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS ix_sale_items_sale_id ON sale_items (sale_id);
CREATE INDEX IF NOT EXISTS ix_sale_items_store_sale ON sale_items (store_id, sale_id);
CREATE INDEX IF NOT EXISTS ix_sale_items_product ON sale_items (store_id, product_id);

CREATE TABLE IF NOT EXISTS stock_movements (
  id VARCHAR(100) PRIMARY KEY,
  store_id VARCHAR(36) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id VARCHAR(36) REFERENCES products(id) ON DELETE SET NULL,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  movement_type VARCHAR(24) NOT NULL,
  quantity NUMERIC(14,3) NOT NULL,
  unit_cost NUMERIC(14,2),
  reason VARCHAR(160),
  reference VARCHAR(100),
  occurred_at TIMESTAMPTZ NOT NULL,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS ix_stock_movements_store_id ON stock_movements (store_id);
CREATE INDEX IF NOT EXISTS ix_stock_movements_store_date ON stock_movements (store_id, occurred_at);
CREATE INDEX IF NOT EXISTS ix_stock_movements_product_date ON stock_movements (store_id, product_id, occurred_at);

CREATE TABLE IF NOT EXISTS fidelity_config (
  store_id VARCHAR(36) PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  points_rate NUMERIC(12,4) NOT NULL DEFAULT 1,
  signup_bonus INTEGER NOT NULL DEFAULT 0,
  discount_points INTEGER NOT NULL DEFAULT 100,
  discount_value NUMERIC(12,2) NOT NULL DEFAULT 5,
  expiry_days INTEGER NOT NULL DEFAULT 365,
  birthday_bonus BOOLEAN NOT NULL DEFAULT FALSE,
  first_purchase_bonus BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS fidelity_transactions (
  id VARCHAR(100) PRIMARY KEY,
  store_id VARCHAR(36) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  client_id VARCHAR(36) NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  sale_id VARCHAR(100) REFERENCES sales(id) ON DELETE SET NULL,
  transaction_type VARCHAR(24) NOT NULL,
  points INTEGER NOT NULL,
  description VARCHAR(240),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS ix_fidelity_transactions_store_id ON fidelity_transactions (store_id);
CREATE INDEX IF NOT EXISTS ix_fidelity_transactions_client_id ON fidelity_transactions (client_id);
CREATE INDEX IF NOT EXISTS ix_fidelity_transactions_client ON fidelity_transactions (store_id, client_id, created_at);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id VARCHAR(100) PRIMARY KEY,
  store_id VARCHAR(36) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  supplier_id VARCHAR(36) REFERENCES suppliers(id) ON DELETE SET NULL,
  number VARCHAR(40) NOT NULL,
  status VARCHAR(24) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  expected_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  estimated_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  received_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_purchase_orders_store_number UNIQUE (store_id, number)
);
CREATE INDEX IF NOT EXISTS ix_purchase_orders_store_id ON purchase_orders (store_id);
CREATE INDEX IF NOT EXISTS ix_purchase_orders_store_status ON purchase_orders (store_id, status, created_at);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id BIGSERIAL PRIMARY KEY,
  store_id VARCHAR(36) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  purchase_order_id VARCHAR(100) NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id VARCHAR(36) REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(200) NOT NULL,
  unit VARCHAR(20),
  quantity_ordered NUMERIC(14,3) NOT NULL,
  quantity_received NUMERIC(14,3) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(14,2) NOT NULL,
  suggested_price NUMERIC(14,2),
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS ix_purchase_order_items_purchase_order_id ON purchase_order_items (purchase_order_id);
CREATE INDEX IF NOT EXISTS ix_purchase_order_items_order ON purchase_order_items (store_id, purchase_order_id);

CREATE TABLE IF NOT EXISTS price_history (
  id VARCHAR(100) PRIMARY KEY,
  store_id VARCHAR(36) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id VARCHAR(36) REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(200) NOT NULL,
  price NUMERIC(14,2) NOT NULL,
  source VARCHAR(160),
  observed_at TIMESTAMPTZ NOT NULL,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS ix_price_history_store_id ON price_history (store_id);
CREATE INDEX IF NOT EXISTS ix_price_history_product_id ON price_history (product_id);
CREATE INDEX IF NOT EXISTS ix_price_history_store_product_date ON price_history (store_id, product_id, observed_at);

CREATE TABLE IF NOT EXISTS store_state (
  store_id VARCHAR(36) PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS alembic_version (
  version_num VARCHAR(32) NOT NULL PRIMARY KEY
);
INSERT INTO alembic_version (version_num)
VALUES ('0002_retail_tables')
ON CONFLICT (version_num) DO UPDATE SET version_num = EXCLUDED.version_num;

COMMIT;
