-- Billing rate config (singleton row expected; service upserts the latest)
CREATE TABLE IF NOT EXISTS billing_rate_configs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  ocr_document_charge DECIMAL(12, 2) NOT NULL DEFAULT 0,
  scrape_site_charge DECIMAL(12, 2) NOT NULL DEFAULT 0,
  server_cost_per_document DECIMAL(12, 2) NOT NULL DEFAULT 0,
  server_cost_per_scrape DECIMAL(12, 2) NOT NULL DEFAULT 0,
  triangulation_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
  physical_verification_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
  monthly_sms_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
  monthly_email_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
  monthly_other_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  updated_by CHAR(36) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
