const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3001;
const SECRET = 'taskflow_secret_key';

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Auth Middleware
const auth = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    jwt.verify(token, SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ message: 'Invalid session' });
        req.userId = decoded.userId;
        next();
    });
};

// --- API Routes ---

// User Auth
app.post('/api/auth/register', (req, res) => {
    const { username, email, password } = req.body;
    const hash = bcrypt.hashSync(password, 10);
    db.run("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", [username, email, hash], (err) => {
        if (err) return res.status(400).json({ message: 'User already exists' });
        res.json({ success: true });
    });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const token = jwt.sign({ userId: user.id }, SECRET);
        res.cookie('token', token, { httpOnly: true });
        res.json({ success: true, user: { id: user.id, username: user.username } });
    });
});

app.get('/api/auth/me', auth, (req, res) => {
    db.get("SELECT id, username, email FROM users WHERE id = ?", [req.userId], (err, user) => {
        res.json(user);
    });
});

// Projects
app.get('/api/projects', auth, (req, res) => {
    // Get projects where user is owner or member
    db.all(`
        SELECT p.* FROM projects p 
        LEFT JOIN project_members pm ON p.id = pm.project_id 
        WHERE p.owner_id = ? OR pm.user_id = ?
        GROUP BY p.id
    `, [req.userId, req.userId], (err, rows) => {
        res.json(rows);
    });
});

app.post('/api/projects', auth, (req, res) => {
    const { name, description } = req.body;
    db.run("INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)", [name, description, req.userId], function(err) {
        res.json({ id: this.lastID, name, description });
    });
});

// Tasks
app.get('/api/projects/:id/tasks', auth, (req, res) => {
    db.all("SELECT tasks.*, users.username as assigned_name FROM tasks LEFT JOIN users ON tasks.assigned_to = users.id WHERE project_id = ?", [req.params.id], (err, rows) => {
        res.json(rows);
    });
});

app.post('/api/tasks', auth, (req, res) => {
    const { project_id, title, description, assigned_to } = req.body;
    db.run("INSERT INTO tasks (project_id, title, description, assigned_to) VALUES (?, ?, ?, ?)", 
        [project_id, title, description, assigned_to], function(err) {
            const taskId = this.lastID;
            io.to(`project_${project_id}`).emit('taskCreated', { id: taskId, title, project_id });
            res.json({ id: taskId });
        });
});

app.patch('/api/tasks/:id/status', auth, (req, res) => {
    const { status, project_id } = req.body;
    db.run("UPDATE tasks SET status = ? WHERE id = ?", [status, req.params.id], () => {
        io.to(`project_${project_id}`).emit('taskUpdated', { id: req.params.id, status });
        res.json({ success: true });
    });
});

// Comments
app.get('/api/tasks/:id/comments', auth, (req, res) => {
    db.all("SELECT c.*, u.username FROM comments c JOIN users u ON c.user_id = u.id WHERE c.task_id = ? ORDER BY c.created_at DESC", [req.params.id], (err, rows) => {
        res.json(rows);
    });
});

app.post('/api/comments', auth, (req, res) => {
    const { task_id, content, project_id } = req.body;
    db.run("INSERT INTO comments (task_id, user_id, content) VALUES (?, ?, ?)", [task_id, req.userId, content], function(err) {
        db.get("SELECT username FROM users WHERE id = ?", [req.userId], (err, user) => {
            io.to(`project_${project_id}`).emit('commentAdded', { task_id, content, username: user.username });
            res.json({ success: true });
        });
    });
});

// --- Socket.io ---
io.on('connection', (socket) => {
    socket.on('joinProject', (projectId) => {
        socket.join(`project_${projectId}`);
    });
});

server.listen(PORT, () => console.log(`TaskFlow running at http://localhost:${PORT}`));
