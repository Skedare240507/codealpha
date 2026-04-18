const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'luxe_shop_secret_key'; // In production, use environment variables

app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to authenticate JWT
const authenticate = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(401).json({ message: 'Invalid token' });
        req.userId = decoded.userId;
        next();
    });
};

// Auth Routes
app.post('/api/auth/register', (req, res) => {
    const { username, email, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);

    db.run("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", [username, email, hashedPassword], function(err) {
        if (err) return res.status(400).json({ message: 'Username or Email already exists' });
        res.json({ success: true });
    });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
        if (err || !user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: '1h' });
        res.cookie('token', token, { httpOnly: true });
        res.json({ success: true, user: { id: user.id, username: user.username } });
    });
});

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
});

app.get('/api/auth/me', authenticate, (req, res) => {
    db.get("SELECT id, username, email FROM users WHERE id = ?", [req.userId], (err, user) => {
        if (err || !user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    });
});

// Product Routes
app.get('/api/products', (req, res) => {
    db.all("SELECT * FROM products", (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
});

app.get('/api/products/:id', (req, res) => {
    db.get("SELECT * FROM products WHERE id = ?", [req.params.id], (err, row) => {
        if (err || !row) return res.status(404).json({ message: 'Product not found' });
        res.json(row);
    });
});

// Order Routes
app.post('/api/orders', authenticate, (req, res) => {
    const { items, total_price } = req.body;
    
    db.run("INSERT INTO orders (user_id, total_price) VALUES (?, ?)", [req.userId, total_price], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        
        const orderId = this.lastID;
        const stmt = db.prepare("INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)");
        
        items.forEach(item => {
            stmt.run([orderId, item.id, item.quantity, item.price]);
        });
        
        stmt.finalize();
        res.json({ success: true, orderId });
    });
});

app.get('/api/my-orders', authenticate, (req, res) => {
    const query = `
        SELECT o.*, oi.quantity, oi.price as item_price, p.name as product_name 
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        JOIN products p ON oi.product_id = p.id
        WHERE o.user_id = ? 
        ORDER BY o.created_at DESC
    `;
    db.all(query, [req.userId], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        
        // Group by order ID
        const orders = rows.reduce((acc, row) => {
            if (!acc[row.id]) {
                acc[row.id] = {
                    id: row.id,
                    total_price: row.total_price,
                    status: row.status,
                    created_at: row.created_at,
                    items: []
                };
            }
            acc[row.id].items.push({
                name: row.product_name,
                quantity: row.quantity,
                price: row.item_price
            });
            return acc;
        }, {});
        
        res.json(Object.values(orders));
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
