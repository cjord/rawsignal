CREATE TABLE sales_summaries (
  product_id INTEGER NOT NULL REFERENCES catalog_products(product_id) ON DELETE CASCADE,
  variant TEXT NOT NULL,
  condition TEXT NOT NULL,
  sales_7 INTEGER,
  sales_30 INTEGER,
  sales_30_prior INTEGER,
  through_date TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  bucket_days INTEGER NOT NULL,
  PRIMARY KEY (product_id, variant, condition)
);
