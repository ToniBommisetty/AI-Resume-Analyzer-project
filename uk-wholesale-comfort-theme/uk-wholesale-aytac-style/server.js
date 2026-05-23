const PDFDocument = require('pdfkit');
require('dotenv').config({ path: '.env' });

const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');
const path = require('path');
const slugify = require('slugify');
const bcrypt = require('bcryptjs');
const Stripe = require('stripe');
const nodemailer = require('nodemailer');

const BetterSQLite3Store = require('better-sqlite3-session-store')(session);
const Database = require('better-sqlite3');

const db = require('./src/db');
const { requireLogin, requireAdmin } = require('./src/middleware');
const { productUpload, bannerUpload } = require('./src/upload');

const app = express();
const PORT = process.env.PORT || 3000;

const stripe = process.env.STRIPE_SECRET_KEY
  ? Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || ''
  }
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.post('/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.sendStatus(400);
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    db.prepare(`
      UPDATE orders
      SET payment_status='paid', stripe_session_id=?
      WHERE stripe_session_id=?
    `).run(session.id, session.id);
  }

  res.json({ received: true });
});
app.use(express.json());
app.use(methodOverride('_method'));

app.use(session({
  store: new BetterSQLite3Store({
    client: new Database('./data/sessions.sqlite'),
    expired: { clear: true, intervalMs: 900000 }
  }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 604800000 }
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.cartCount = (req.session.cart || []).reduce((s, i) => s + i.qty, 0);
  res.locals.categories = db.prepare('SELECT * FROM categories ORDER BY sort_order,name').all();
  next();
});

const makeSlug = t => slugify(t || '', { lower: true, strict: true }) || Date.now().toString();

db.prepare(`
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`).run();

try {
  db.prepare(`ALTER TABLE orders ADD COLUMN fulfillment_method TEXT DEFAULT 'delivery'`).run();
} catch (e) {}

try {
  db.prepare(`ALTER TABLE orders ADD COLUMN collection_branch TEXT`).run();
} catch (e) {}


db.prepare(`
  CREATE TABLE IF NOT EXISTS product_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    image TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
  )
`).run();

try {
  db.prepare(`ALTER TABLE orders ADD COLUMN stripe_session_id TEXT`).run();
} catch (e) {}

/* HOME */
app.get('/', (req, res) => {
  res.render('pages/home', {
    banners: db.prepare('SELECT * FROM banners WHERE is_active=1 ORDER BY sort_order,id LIMIT 4').all(),
    bestSellers: db.prepare('SELECT * FROM products WHERE is_best_seller=1 AND is_active=1 LIMIT 8').all(),
    catering: db.prepare("SELECT * FROM products WHERE is_active=1 AND category_id=(SELECT id FROM categories WHERE slug='catering') LIMIT 8").all()
  });
});

/* PRODUCTS */
app.get('/products', (req, res) => {
  const q = (req.query.q || '').trim();
  const category = req.query.category || '';
  const minPrice = req.query.minPrice || '';
  const maxPrice = req.query.maxPrice || '';
  const inStock = req.query.inStock || '';
  const brand = req.query.brand || '';

  let sql = `
    SELECT p.*, c.name category_name
    FROM products p
    JOIN categories c ON p.category_id=c.id
    WHERE p.is_active=1
  `;

  const params = {};

  if (q) {
    sql += ' AND (p.name LIKE @q OR p.brand LIKE @q OR p.sku LIKE @q)';
    params.q = `%${q}%`;
  }

  if (category) {
    sql += ' AND c.slug=@category';
    params.category = category;
  }

  if (minPrice) {
    sql += ' AND p.price >= @minPrice';
    params.minPrice = Number(minPrice);
  }

  if (maxPrice) {
    sql += ' AND p.price <= @maxPrice';
    params.maxPrice = Number(maxPrice);
  }

  if (inStock) {
    sql += ' AND p.stock > 0';
  }

  if (brand) {
    sql += ' AND p.brand LIKE @brand';
    params.brand = `%${brand}%`;
  }

  sql += ' ORDER BY p.name';

  res.render('pages/products', {
    products: db.prepare(sql).all(params),
    q,
    category,
    minPrice,
    maxPrice,
    inStock,
    brand
  });
});

app.get('/product/:slug', (req, res) => {
  const product = db.prepare(`
    SELECT p.*, c.name category_name
    FROM products p
    JOIN categories c ON p.category_id=c.id
    WHERE p.slug=? AND p.is_active=1
  `).get(req.params.slug);

  if (!product) return res.status(404).render('pages/not-found');

  const extraImages = db.prepare(`
    SELECT * FROM product_images
    WHERE product_id=?
    ORDER BY sort_order,id
  `).all(product.id);

  const images = [
    product.image || '/images/placeholder-product.svg',
    ...extraImages.map(i => i.image)
  ];

  const reviews = db.prepare(`
    SELECT r.*, u.name
    FROM reviews r
    JOIN users u ON r.user_id = u.id
    WHERE r.product_id = ?
    ORDER BY r.created_at DESC
  `).all(product.id);

  res.render('pages/product-detail', { product, reviews, images });
});

app.post('/product/:id/review', requireLogin, (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);

  if (!product) return res.redirect('/products');

  db.prepare(`
    INSERT INTO reviews (product_id,user_id,rating,comment)
    VALUES (?,?,?,?)
  `).run(
    product.id,
    req.session.user.id,
    Number(req.body.rating || 5),
    req.body.comment || ''
  );

  res.redirect(`/product/${product.slug}`);
});

/* DASHBOARDS */
app.get('/dashboard', requireLogin, (req, res) => {
  res.redirect(req.session.user.role === 'admin' ? '/admin' : '/customer');
});

app.get('/customer', requireLogin, (req, res) => {
  const recentOrders = db
    .prepare('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT 3')
    .all(req.session.user.id);

  const featuredProducts = db
    .prepare('SELECT * FROM products WHERE is_active=1 ORDER BY created_at DESC LIMIT 4')
    .all();

  res.render('pages/customer-dashboard', {
    recentOrders,
    featuredProducts
  });
});

/* AUTH */
app.get('/register', (req, res) => {
  res.render('pages/register', { error: null });
});

app.post('/register', (req, res) => {
  const { name, email, password, business_name, phone } = req.body;

  if (!name || !email || !password) {
    return res.render('pages/register', {
      error: 'Name, email and password are required.'
    });
  }

  if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) {
    return res.render('pages/register', {
      error: 'Email already registered.'
    });
  }

  const info = db.prepare(`
    INSERT INTO users (name,email,password,business_name,phone,role)
    VALUES (?,?,?,?,?,?)
  `).run(
    name,
    email,
    bcrypt.hashSync(password, 10),
    business_name || '',
    phone || '',
    'customer'
  );

  req.session.user = {
    id: info.lastInsertRowid,
    name,
    email,
    role: 'customer'
  };

  res.redirect('/customer');
});

app.get('/login', (req, res) => {
  res.render('pages/login', { error: null });
});

app.post('/login', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(req.body.email);

  if (!user || !bcrypt.compareSync(req.body.password, user.password)) {
    return res.render('pages/login', {
      error: 'Invalid email or password.'
    });
  }

  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };

  res.redirect(user.role === 'admin' ? '/admin' : '/customer');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

/* CART */
app.post('/cart/add/:id', requireLogin, (req, res) => {
  const p = db.prepare(`
    SELECT id,name,price,slug
    FROM products
    WHERE id=? AND is_active=1
  `).get(req.params.id);

  if (!p) return res.redirect('/products');

  const qty = Math.max(parseInt(req.body.qty || '1'), 1);

  req.session.cart = req.session.cart || [];

  const existing = req.session.cart.find(i => i.id === p.id);

  if (existing) {
    existing.qty += qty;
  } else {
    req.session.cart.push({ ...p, qty });
  }

  res.redirect('/cart');
});

app.get('/cart', (req, res) => {
  const cart = req.session.cart || [];

  res.render('pages/cart', {
    cart,
    total: cart.reduce((s, i) => s + i.price * i.qty, 0)
  });
});

app.post('/cart/update/:id', (req, res) => {
  const item = (req.session.cart || []).find(x => x.id == req.params.id);

  if (item) {
    item.qty = Math.max(parseInt(req.body.qty || '1'), 1);
  }

  res.redirect('/cart');
});

app.post('/cart/remove/:id', (req, res) => {
  req.session.cart = (req.session.cart || []).filter(i => i.id != req.params.id);
  res.redirect('/cart');
});

/* CHECKOUT */
app.get('/checkout', requireLogin, (req, res) => {
  const cart = req.session.cart || [];

  if (!cart.length) return res.redirect('/cart');

  res.render('pages/checkout', {
    cart,
    total: cart.reduce((s, i) => s + i.price * i.qty, 0),
    error: null
  });
});

app.post('/checkout', requireLogin, async (req, res) => {
  const cart = req.session.cart || [];

  if (!cart.length) return res.redirect('/cart');

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const paymentMethod = req.body.payment_method || 'pay_on_delivery';
  const fulfillmentMethod = req.body.fulfillment_method || 'delivery';
  const collectionBranch = req.body.collection_branch || '';

  const info = db.prepare(`
  INSERT INTO orders 
  (user_id,total,status,delivery_address,notes,payment_method,payment_status,fulfillment_method,collection_branch)
  VALUES (?,?,?,?,?,?,?,?,?)
`).run(
  req.session.user.id,
  total,
  'pending',
  req.body.delivery_address || '',
  req.body.notes || '',
  paymentMethod,
  'pending',
  fulfillmentMethod,
  collectionBranch
);

  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id,product_id,product_name,qty,price)
    VALUES (?,?,?,?,?)
  `);

  const reduceStock = db.prepare(`
    UPDATE products
    SET stock = CASE
      WHEN stock - ? < 0 THEN 0
      ELSE stock - ?
    END
    WHERE id = ?
  `);

  cart.forEach(item => {
    insertItem.run(info.lastInsertRowid, item.id, item.name, item.qty, item.price);
    reduceStock.run(item.qty, item.qty, item.id);
  });

  try {
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      await mailer.sendMail({
        from: process.env.EMAIL_USER,
        to: req.session.user.email,
        subject: `Order Confirmation #${info.lastInsertRowid}`,
        text: `Thank you for your order. Your order #${info.lastInsertRowid} total is £${total.toFixed(2)}.`
      });
    }
  } catch (err) {
    console.log('Email failed:', err.message);
  }

  if (paymentMethod === 'card' && stripe) {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      success_url: `http://localhost:${PORT}/order-success/${info.lastInsertRowid}`,
      cancel_url: `http://localhost:${PORT}/cart`,
      line_items: cart.map(item => ({
        price_data: {
          currency: 'gbp',
          product_data: {
            name: item.name
          },
          unit_amount: Math.round(item.price * 100)
        },
        quantity: item.qty
      }))
    });

    db.prepare(`
  UPDATE orders
  SET stripe_session_id=?
  WHERE id=?
`).run(session.id, info.lastInsertRowid);

    req.session.cart = [];
    return res.redirect(session.url);
  }

  if (paymentMethod === 'card' && !stripe) {
    console.log('Stripe key missing. Using normal checkout instead.');
  }

  req.session.cart = [];

  res.redirect(`/order-success/${info.lastInsertRowid}`);
});

app.get('/order-success/:id', requireLogin, (req, res) => {
  const order = db.prepare(`
    SELECT * FROM orders
    WHERE id = ? AND user_id = ?
  `).get(req.params.id, req.session.user.id);

  if (!order) return res.status(404).render('pages/not-found');

  res.render('pages/order-success', { order });
});

/* CUSTOMER ORDERS */
app.get('/account/orders', requireLogin, (req, res) => {
  const orders = db.prepare(`
    SELECT * FROM orders
    WHERE user_id=?
    ORDER BY created_at DESC
  `).all(req.session.user.id);

  res.render('pages/orders', { orders });
});

app.get('/account/orders/:id', requireLogin, (req, res) => {
  const order = db.prepare(`
    SELECT * FROM orders
    WHERE id = ? AND user_id = ?
  `).get(req.params.id, req.session.user.id);

  if (!order) return res.status(404).render('pages/not-found');

  const items = db.prepare(`
    SELECT * FROM order_items
    WHERE order_id = ?
  `).all(req.params.id);

  res.render('pages/customer-order-detail', { order, items });
});

/* ADMIN */
app.get('/admin', requireAdmin, (req, res) => {
  res.render('pages/admin-dashboard', {
    stats: {
      products: db.prepare('SELECT COUNT(*) n FROM products').get().n,
      orders: db.prepare('SELECT COUNT(*) n FROM orders').get().n,
      customers: db.prepare("SELECT COUNT(*) n FROM users WHERE role='customer'").get().n
    }
  });
});

app.get('/admin/products', requireAdmin, (req, res) => {
  const q = (req.query.q || '').trim();

  let sql = `
    SELECT p.*, c.name category_name
    FROM products p
    JOIN categories c ON p.category_id = c.id
  `;

  const params = {};

  if (q) {
    sql += `
      WHERE p.name LIKE @q
      OR p.brand LIKE @q
      OR p.sku LIKE @q
      OR c.name LIKE @q
    `;
    params.q = `%${q}%`;
  }

  sql += ` ORDER BY p.id DESC`;

  res.render('pages/admin-products', {
    products: db.prepare(sql).all(params),
    q
  });
});

app.get('/admin/products/new', requireAdmin, (req, res) => {
  res.render('pages/admin-product-form', {
    product: null,
    action: '/admin/products',
    title: 'Add Product'
  });
});

app.post('/admin/products', requireAdmin, productUpload.single('image_file'), (req, res) => {
  const image = req.file
    ? `/uploads/products/${req.file.filename}`
    : '/images/placeholder-product.svg';

  db.prepare(`
    INSERT INTO products
    (name,slug,sku,brand,category_id,price,stock,image,description,is_best_seller,is_active)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    req.body.name,
    req.body.slug || makeSlug(req.body.name),
    req.body.sku || '',
    req.body.brand || '',
    req.body.category_id,
    req.body.price || 0,
    req.body.stock || 0,
    image,
    req.body.description || '',
    req.body.is_best_seller ? 1 : 0,
    req.body.is_active ? 1 : 0
  );

  res.redirect('/admin/products');
});

app.get('/admin/products/:id/edit', requireAdmin, (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);

  res.render('pages/admin-product-form', {
    product,
    action: `/admin/products/${product.id}?_method=PUT`,
    title: 'Edit Product'
  });
});

app.put('/admin/products/:id', requireAdmin, productUpload.single('image_file'), (req, res) => {
  const current = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);

  const image = req.file
    ? `/uploads/products/${req.file.filename}`
    : current.image;

  db.prepare(`
    UPDATE products
    SET name=?,slug=?,sku=?,brand=?,category_id=?,price=?,stock=?,image=?,description=?,is_best_seller=?,is_active=?
    WHERE id=?
  `).run(
    req.body.name,
    req.body.slug || makeSlug(req.body.name),
    req.body.sku || '',
    req.body.brand || '',
    req.body.category_id,
    req.body.price || 0,
    req.body.stock || 0,
    image,
    req.body.description || '',
    req.body.is_best_seller ? 1 : 0,
    req.body.is_active ? 1 : 0,
    req.params.id
  );

  res.redirect('/admin/products');
});

app.delete('/admin/products/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);
  res.redirect('/admin/products');
});

app.get('/admin/categories', requireAdmin, (req, res) => {
  res.render('pages/admin-categories', {
    allCategories: db.prepare('SELECT * FROM categories ORDER BY sort_order,name').all()
  });
});

app.post('/admin/categories', requireAdmin, (req, res) => {
  db.prepare(`
    INSERT OR IGNORE INTO categories (name,slug,sort_order)
    VALUES (?,?,?)
  `).run(
    req.body.name,
    req.body.slug || makeSlug(req.body.name),
    req.body.sort_order || 0
  );

  res.redirect('/admin/categories');
});

app.delete('/admin/categories/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM categories WHERE id=?').run(req.params.id);
  res.redirect('/admin/categories');
});

app.get('/admin/banners', requireAdmin, (req, res) => {
  res.render('pages/admin-banners', {
    banners: db.prepare('SELECT * FROM banners ORDER BY sort_order,id').all()
  });
});

app.post('/admin/banners', requireAdmin, bannerUpload.single('image_file'), (req, res) => {
  const image = req.file
    ? `/uploads/banners/${req.file.filename}`
    : '/images/hero.svg';

  db.prepare(`
    INSERT INTO banners (title,subtitle,image,button_text,button_link,is_active,sort_order)
    VALUES (?,?,?,?,?,?,?)
  `).run(
    req.body.title,
    req.body.subtitle || '',
    image,
    req.body.button_text || 'Shop Now',
    req.body.button_link || '/products',
    req.body.is_active ? 1 : 0,
    req.body.sort_order || 0
  );

  res.redirect('/admin/banners');
});

app.delete('/admin/banners/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM banners WHERE id=?').run(req.params.id);
  res.redirect('/admin/banners');
});

app.get('/admin/orders', requireAdmin, (req, res) => {
  res.render('pages/admin-orders', {
    orders: db.prepare(`
      SELECT o.*, u.name, u.email
      FROM orders o
      JOIN users u ON o.user_id=u.id
      ORDER BY o.created_at DESC
    `).all()
  });
});

app.get('/admin/orders/:id', requireAdmin, (req, res) => {
  const order = db.prepare(`
    SELECT o.*, u.name, u.email, u.phone, u.business_name
    FROM orders o
    JOIN users u ON o.user_id = u.id
    WHERE o.id = ?
  `).get(req.params.id);

  if (!order) return res.status(404).render('pages/not-found');

  const items = db.prepare(`
    SELECT * FROM order_items
    WHERE order_id = ?
  `).all(req.params.id);

  res.render('pages/admin-order-detail', { order, items });
});

app.post('/admin/orders/:id/status', requireAdmin, (req, res) => {
  db.prepare('UPDATE orders SET status=? WHERE id=?').run(req.body.status, req.params.id);
  res.redirect('/admin/orders');
});

/* SEARCH */
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').trim();

  if (!q) return res.json([]);

  const products = db.prepare(`
    SELECT p.id, p.name, p.slug, p.price, p.image, p.brand, c.name category_name
    FROM products p
    JOIN categories c ON p.category_id = c.id
    WHERE p.is_active = 1
    AND (
      p.name LIKE ?
      OR p.brand LIKE ?
      OR p.sku LIKE ?
      OR p.description LIKE ?
      OR c.name LIKE ?
    )
    ORDER BY p.name
    LIMIT 12
  `).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);

  res.json(products);
});

/* ADMIN REGISTER */
app.get('/admin-register', (req, res) => {
  res.render('pages/admin-register', { error: null });
});

app.post('/admin-register', (req, res) => {
  const { name, email, password, secretCode } = req.body;

  if (secretCode !== 'ADMIN2025') {
    return res.render('pages/admin-register', {
      error: 'Invalid admin secret code'
    });
  }

  const hash = bcrypt.hashSync(password, 10);

  try {
    db.prepare(`
      INSERT INTO users (name, email, password, role)
      VALUES (?, ?, ?, ?)
    `).run(name, email, hash, 'admin');

    res.redirect('/login');
  } catch (err) {
    res.render('pages/admin-register', {
      error: 'Email already exists'
    });
  }
});


app.get('/account/profile', requireLogin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.session.user.id);
  res.render('pages/profile', { user, error: null, success: null });
});

app.post('/account/profile', requireLogin, (req, res) => {
  const { name, phone, business_name, current_password, new_password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.session.user.id);

  let password = user.password;

  if (new_password) {
    if (!current_password || !bcrypt.compareSync(current_password, user.password)) {
      return res.render('pages/profile', {
        user,
        error: 'Current password is incorrect.',
        success: null
      });
    }

    password = bcrypt.hashSync(new_password, 10);
  }

  db.prepare(`
    UPDATE users
    SET name=?, phone=?, business_name=?, password=?
    WHERE id=?
  `).run(
    name,
    phone || '',
    business_name || '',
    password,
    req.session.user.id
  );

  req.session.user.name = name;

  const updatedUser = db.prepare('SELECT * FROM users WHERE id=?').get(req.session.user.id);

  res.render('pages/profile', {
    user: updatedUser,
    error: null,
    success: 'Profile updated successfully.'
  });
});


app.get('/invoice/:id', requireLogin, (req, res) => {
  const order = db.prepare(`
    SELECT o.*, u.name, u.email, u.phone, u.business_name
    FROM orders o
    JOIN users u ON o.user_id = u.id
    WHERE o.id = ?
  `).get(req.params.id);

  if (!order) return res.status(404).render('pages/not-found');

  if (req.session.user.role !== 'admin' && order.user_id !== req.session.user.id) {
    return res.redirect('/customer');
  }

  const items = db.prepare(`SELECT * FROM order_items WHERE order_id=?`).all(order.id);

  const doc = new PDFDocument({ margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.id}.pdf`);

  doc.pipe(res);

  doc.fontSize(24).text('Toni Wholesale Store', { align: 'center' });
  doc.moveDown();
  doc.fontSize(18).text(`Invoice #${order.id}`);
  doc.fontSize(11).text(`Date: ${order.created_at}`);
  doc.text(`Customer: ${order.name}`);
  doc.text(`Email: ${order.email}`);
  doc.text(`Phone: ${order.phone || 'N/A'}`);
  doc.text(`Business: ${order.business_name || 'N/A'}`);
  doc.text(`Fulfillment: ${order.fulfillment_method || 'delivery'}`);
  doc.text(`Collection Branch: ${order.collection_branch || 'N/A'}`);
  doc.text(`Payment: ${order.payment_method || 'N/A'} / ${order.payment_status || 'pending'}`);
  doc.moveDown();

  doc.fontSize(14).text('Items');
  doc.moveDown();

  items.forEach(item => {
    doc.fontSize(11).text(
      `${item.product_name} | Qty: ${item.qty} | £${Number(item.price).toFixed(2)} | Total: £${Number(item.price * item.qty).toFixed(2)}`
    );
  });

  doc.moveDown();
  doc.fontSize(16).text(`Total: £${Number(order.total).toFixed(2)}`, { align: 'right' });

  doc.end();
});

app.get('/admin/analytics', requireAdmin, (req, res) => {
  const stats = {
    revenue: db.prepare(`SELECT COALESCE(SUM(total),0) n FROM orders`).get().n,
    orders: db.prepare(`SELECT COUNT(*) n FROM orders`).get().n,
    customers: db.prepare(`SELECT COUNT(*) n FROM users WHERE role='customer'`).get().n,
    lowStock: db.prepare(`SELECT COUNT(*) n FROM products WHERE stock <= 10`).get().n
  };

  const statusRows = db.prepare(`
    SELECT status, COUNT(*) count
    FROM orders
    GROUP BY status
  `).all();

  const topProducts = db.prepare(`
    SELECT product_name, SUM(qty) qty
    FROM order_items
    GROUP BY product_name
    ORDER BY qty DESC
    LIMIT 5
  `).all();

  res.render('pages/admin-analytics', { stats, statusRows, topProducts });
});

app.get('/forgot-password', (req, res) => {
  res.render('pages/forgot-password', { error: null, success: null });
});

app.post('/forgot-password', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(req.body.email);

  if (!user) {
    return res.render('pages/forgot-password', {
      error: 'Email not found.',
      success: null
    });
  }

  res.render('pages/forgot-password', {
    error: null,
    success: 'Password reset demo: please contact admin to reset your password.'
  });
});

app.listen(PORT, () => {
  console.log(`Wholesale site running at http://localhost:${PORT}`);
});



