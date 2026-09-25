CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     VARCHAR(120) NOT NULL,
  email         VARCHAR(160) UNIQUE NOT NULL,
  phone         VARCHAR(30),
  password_hash TEXT NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'customer',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE addresses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label       VARCHAR(50),
  city        VARCHAR(60) NOT NULL,
  district    VARCHAR(100),
  details     TEXT,
  phone       VARCHAR(30),
  is_default  BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
  name        VARCHAR(80) NOT NULL,
  slug        VARCHAR(80) UNIQUE NOT NULL,
  icon        VARCHAR(20),
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE products (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id    UUID REFERENCES categories(id) ON DELETE SET NULL,
  name           VARCHAR(160) NOT NULL,
  description    TEXT,
  sku            VARCHAR(60) UNIQUE,
  price          NUMERIC(10,2) NOT NULL,
  compare_price  NUMERIC(10,2),
  cost_price     NUMERIC(10,2),
  stock_qty      INT NOT NULL DEFAULT 0,
  status         VARCHAR(20) NOT NULL DEFAULT 'active',
  is_featured    BOOLEAN NOT NULL DEFAULT FALSE,
  is_bestseller  BOOLEAN NOT NULL DEFAULT FALSE,
  sold_count     INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE product_variants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size        VARCHAR(20),
  color       VARCHAR(30),
  stock_qty   INT NOT NULL DEFAULT 0,
  extra_price NUMERIC(10,2) NOT NULL DEFAULT 0
);

CREATE TABLE product_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0
);

CREATE TABLE banners (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       VARCHAR(160),
  subtitle    VARCHAR(200),
  image_url   TEXT,
  link_url    TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at   TIMESTAMPTZ,
  ends_at     TIMESTAMPTZ
);

CREATE TABLE cart_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id  UUID REFERENCES product_variants(id),
  quantity    INT NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id, variant_id)
);

CREATE TABLE wishlist_items (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE wallets (
  user_id  UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance  NUMERIC(10,2) NOT NULL DEFAULT 0
);

CREATE TABLE wallet_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      NUMERIC(10,2) NOT NULL,
  type        VARCHAR(30) NOT NULL,
  reference   VARCHAR(120),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number    VARCHAR(20) UNIQUE NOT NULL,
  user_id         UUID NOT NULL REFERENCES users(id),
  address_id      UUID REFERENCES addresses(id),
  subtotal        NUMERIC(10,2) NOT NULL,
  shipping_fee    NUMERIC(10,2) NOT NULL DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL,
  status          VARCHAR(30) NOT NULL DEFAULT 'pending',
  payment_method  VARCHAR(30) NOT NULL,
  payment_status  VARCHAR(20) NOT NULL DEFAULT 'unpaid',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES products(id),
  variant_id    UUID REFERENCES product_variants(id),
  product_name  VARCHAR(160) NOT NULL,
  unit_price    NUMERIC(10,2) NOT NULL,
  quantity      INT NOT NULL
);

CREATE TABLE payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose        VARCHAR(20) NOT NULL DEFAULT 'order',
  order_id       UUID REFERENCES orders(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  provider       VARCHAR(30) NOT NULL,
  provider_ref   VARCHAR(120),
  amount         NUMERIC(10,2) NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'pending',
  raw_response   JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE returns (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id),
  user_id     UUID NOT NULL REFERENCES users(id),
  reason      VARCHAR(200) NOT NULL,
  details     TEXT,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE settings (
  key         VARCHAR(60) PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO settings (key, value) VALUES
  ('theme', '{"primary":"#3B1E2B","primary_deep":"#2A1420","accent":"#C9A34E","accent_soft":"#E7D6A8","background":"#F7F1E6"}'),
  ('identity', '{"store_name":"دِثار","logo_icon":"👗"}'),
  ('contact', '{"whatsapp":"218900000000","phone":"0910000000"}');

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_status   ON products(status);
CREATE INDEX idx_orders_user       ON orders(user_id);
CREATE INDEX idx_orders_status     ON orders(status);
CREATE INDEX idx_cart_user         ON cart_items(user_id);
