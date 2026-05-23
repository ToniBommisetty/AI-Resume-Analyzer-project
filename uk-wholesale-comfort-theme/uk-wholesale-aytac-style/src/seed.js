
const bcrypt=require('bcryptjs'); const db=require('./db');
const cats=[['Shop & Retail','shop-retail',1],['Catering','catering',2],['Fruit & Veg','fruit-veg',3],['Groceries','groceries',4],['Bakery','bakery',5],['Chilled','chilled',6],['Confectionery','confectionery',7],['Drinks','drinks',8],['Non Food','non-food',9],['Pulses','pulses',10]];
cats.forEach(c=>db.prepare('INSERT OR IGNORE INTO categories (name,slug,sort_order) VALUES (?,?,?)').run(...c));
const cat=s=>db.prepare('SELECT id FROM categories WHERE slug=?').get(s).id;
const ps=[
['Pure Honey Octagon Jar 500G','pure-honey-octagon-jar-500g','HNY500','UK Wholesale',cat('groceries'),29.99,50,'/images/placeholder-product.svg','Wholesale honey jar pack.',1],
['Silver Spoon Sugar 15 x 1KG','silver-spoon-sugar-15x1kg','SUG15','UK Wholesale',cat('catering'),18.50,100,'/images/placeholder-product.svg','Bulk sugar case.',1],
['Microwave Food Container 650ml Pack of 250','microwave-food-container-650ml','CNT650','Catering',cat('catering'),22.99,80,'/images/placeholder-product.svg','Food containers for takeaway and catering.',1],
['Blue Roll Centrefeed Pack of 6','blue-roll-centrefeed-6','BLR6','Non Food',cat('non-food'),8.49,60,'/images/placeholder-product.svg','Cleaning and hygiene roll pack.',1],
['Coca Cola 500ml Pack of 12','coca-cola-500ml-pack-12','CC500','Drinks',cat('drinks'),7.49,100,'/images/placeholder-product.svg','Soft drink case.',1]];
ps.forEach(p=>db.prepare('INSERT OR IGNORE INTO products (name,slug,sku,brand,category_id,price,stock,image,description,is_best_seller) VALUES (?,?,?,?,?,?,?,?,?,?)').run(...p));
db.prepare(`INSERT OR IGNORE INTO banners (id,title,subtitle,image,button_text,button_link,is_active,sort_order) VALUES (1,'Wholesale Food & Catering Supplies','Staff can add products, prices, stock, images and banners without coding.','/images/hero.svg','Shop Products','/products',1,1)`).run();
if(!db.prepare('SELECT id FROM users WHERE email=?').get('admin@example.com')){
 db.prepare('INSERT INTO users (name,email,password,business_name,phone,role) VALUES (?,?,?,?,?,?)').run('Admin User','admin@example.com',bcrypt.hashSync('admin123',10),'Wholesale Admin','07000000000','admin');
}
console.log('Database seeded. Admin login: admin@example.com / admin123');
