
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
const db = new Database(path.join(dataDir, 'database.sqlite'));
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,slug TEXT NOT NULL UNIQUE,sort_order INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,slug TEXT NOT NULL UNIQUE,sku TEXT,brand TEXT,category_id INTEGER NOT NULL,price REAL DEFAULT 0,stock INTEGER DEFAULT 0,image TEXT,description TEXT,is_best_seller INTEGER DEFAULT 0,is_active INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(category_id) REFERENCES categories(id));
CREATE TABLE IF NOT EXISTS banners (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,subtitle TEXT,image TEXT,button_text TEXT,button_link TEXT,is_active INTEGER DEFAULT 1,sort_order INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password TEXT NOT NULL,business_name TEXT,phone TEXT,role TEXT DEFAULT 'customer',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,total REAL NOT NULL,status TEXT DEFAULT 'pending',delivery_address TEXT NOT NULL,notes TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER NOT NULL,product_id INTEGER NOT NULL,product_name TEXT NOT NULL,qty INTEGER NOT NULL,price REAL NOT NULL,FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,FOREIGN KEY(product_id) REFERENCES products(id));
`);
module.exports = db;
