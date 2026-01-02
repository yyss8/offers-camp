CREATE DATABASE IF NOT EXISTS offers_camp
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS offers_camp.offers (
  id VARCHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary TEXT,
  image TEXT,
  expires DATE,
  categories JSON,
  channels JSON,
  enrolled BOOLEAN DEFAULT FALSE,
  card_num VARCHAR(8) NOT NULL,
  card_label VARCHAR(191),
  source VARCHAR(32) DEFAULT 'amex',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id, card_num, user_id),
  KEY offers_user_id_idx (user_id)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS offers_camp.users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL,
  email VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email_verified TINYINT(1) NOT NULL DEFAULT 0,
  email_verified_at DATETIME NULL,
  email_verify_code_hash VARCHAR(64),
  email_verify_expires_at DATETIME NULL,
  api_token_hash VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_username_unique (username),
  UNIQUE KEY users_email_unique (email)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;
