const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'ecommerce.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        password TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Products table
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        description TEXT,
        price REAL,
        image_url TEXT,
        category TEXT,
        stock INTEGER DEFAULT 10
    )`);

    // Orders table
    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        total_price REAL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Order items table
    db.run(`CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        product_id INTEGER,
        quantity INTEGER,
        price REAL,
        FOREIGN KEY(order_id) REFERENCES orders(id),
        FOREIGN KEY(product_id) REFERENCES products(id)
    )`);

    // Seed products if empty
    db.get("SELECT count(*) as count FROM products", (err, row) => {
        if (row.count === 0) {
            const products = [
                ['Zenith Smartwatch', 'Experience premium health tracking and elegant design.', 199.99, 'https://images.unsplash.com/photo-1544117518-30dd0578cbbd?auto=format&fit=crop&w=500', 'Electronics'],
                ['Aura Noise-Cancelling Headphones', 'Pure sound, zero distractions. High-fidelity audio.', 299.99, 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=500', 'Electronics'],
                ['Nova Wireless Mouse', 'Ergonomic design with ultra-fast tracking.', 49.99, 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=500', 'Accessories'],
                ['Titan Mechanical Keyboard', 'Satisfying tactile feedback and customizable RGB.', 129.99, 'https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?auto=format&fit=crop&w=500', 'Electronics'],
                ['Lumina Desk Lamp', 'Smart lighting with adjustable color temperature.', 79.99, 'https://images.unsplash.com/photo-1534073828943-f801091bb270?auto=format&fit=crop&w=500', 'Home'],
                ['Vortex Bluetooth Speaker', 'Deep bass and 360-degree immersive sound.', 89.99, 'https://images.unsplash.com/photo-1589003020683-95634f5a1bc6?auto=format&fit=crop&w=500', 'Electronics']
            ];

            const stmt = db.prepare("INSERT INTO products (name, description, price, image_url, category) VALUES (?, ?, ?, ?, ?)");
            products.forEach(p => stmt.run(p));
            stmt.finalize();
            console.log("Seeded initial products.");
        }
    });
});

module.exports = db;
