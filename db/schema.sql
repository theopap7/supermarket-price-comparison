CREATE TABLE users (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  profile_photo VARCHAR(255) DEFAULT NULL,
  tokens INT NOT NULL DEFAULT 100,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
);

CREATE TABLE administrators (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_administrators_email (email)
);

CREATE TABLE categories (
  id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE subcategories (
  id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  parent_category_id INT NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_subcategories_category FOREIGN KEY (parent_category_id) REFERENCES categories (id)
);

CREATE TABLE products (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  category_id INT NOT NULL,
  subcategory_id INT NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id),
  CONSTRAINT fk_products_subcategory FOREIGN KEY (subcategory_id) REFERENCES subcategories (id)
);

CREATE TABLE supermarkets (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  latitude DECIMAL(10,6) NOT NULL,
  longitude DECIMAL(10,6) NOT NULL,
  address VARCHAR(255) DEFAULT NULL,
  city VARCHAR(255) DEFAULT NULL,
  country VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE prices (
  id INT NOT NULL AUTO_INCREMENT,
  product_id INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  date DATE NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_prices_product_date (product_id, date),
  CONSTRAINT fk_prices_product FOREIGN KEY (product_id) REFERENCES products (id)
);

CREATE TABLE offers (
  id INT NOT NULL AUTO_INCREMENT,
  product_id INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  date DATE NOT NULL,
  added_by INT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  supermarket_id INT NOT NULL,
  reward_points INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT fk_offers_product FOREIGN KEY (product_id) REFERENCES products (id),
  CONSTRAINT fk_offers_user FOREIGN KEY (added_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_offers_supermarket FOREIGN KEY (supermarket_id) REFERENCES supermarkets (id)
);

CREATE TABLE ratings (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  offer_id INT NOT NULL,
  action ENUM('like', 'dislike') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ratings_user_offer (user_id, offer_id),
  CONSTRAINT fk_ratings_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_ratings_offer FOREIGN KEY (offer_id) REFERENCES offers (id) ON DELETE CASCADE
);

CREATE TABLE sessions (
  id VARCHAR(128) NOT NULL,
  data TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_sessions_expires_at (expires_at)
);
