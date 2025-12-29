CREATE DATABASE IF NOT EXISTS cc_checker;
USE cc_checker;

CREATE TABLE IF NOT EXISTS offers (
  id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary TEXT,
  image TEXT,
  expires VARCHAR(64),
  categories JSON,
  channels JSON,
  enrolled BOOLEAN DEFAULT FALSE,
  card_last5 VARCHAR(8) NOT NULL,
  source VARCHAR(32) DEFAULT 'amex',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id, card_last5)
);
