CREATE DATABASE IF NOT EXISTS offers_camp
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
USE offers_camp;

CREATE TABLE IF NOT EXISTS offers (
  id VARCHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
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
  PRIMARY KEY (id, card_last5, user_id),
  KEY offers_user_id_idx (user_id)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL,
  email VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  api_token_hash VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_username_unique (username),
  UNIQUE KEY users_email_unique (email)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;
