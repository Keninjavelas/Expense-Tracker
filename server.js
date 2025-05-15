const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcrypt');
const app = express();

// Database setup
const db = new sqlite3.Database('./database.db');

// Create tables if they don't exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      note TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'expense_tracker_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  }
}));

// CORS configuration
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5500');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Auth middleware
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(403).json({ error: 'Not authenticated' });
  }
  next();
};

// Routes
app.post('/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 12);
    
    db.run(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [username, hashedPassword],
      function(err) {
        if (err) {
          return res.status(400).json({ error: 'Username already exists' });
        }
        req.session.userId = this.lastID;
        res.json({ success: true });
      }
    );
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ Login Route
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.get(
    'SELECT * FROM users WHERE username = ?',
    [username],
    async (err, user) => {
      if (err || !user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      req.session.userId = user.id;
      res.json({ success: true });
    }
  );
});

// ✅ Reset Password Route (completely separate)
// ✅ Reset Password Route
app.post('/reset-password', async (req, res) => {
  const { username, newPassword } = req.body;
  console.log('Password reset request for:', username);

  if (!username || !newPassword) {
    return res.status(400).json({ error: 'Missing username or new password' });
  }

  try {
    const hashed = await bcrypt.hash(newPassword, 12);
    db.run(
      'UPDATE users SET password = ? WHERE username = ?',
      [hashed, username],
      function (err) {
        if (err) {
          console.error('DB error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'User not found' });
        }
        res.json({ success: true });
      }
    );
  } catch (err) {
    console.error('Hashing error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ Login Route (separate and clean)
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.get(
    'SELECT * FROM users WHERE username = ?',
    [username],
    async (err, user) => {
      if (err || !user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      req.session.userId = user.id;
      res.json({ success: true });
    }
  );
});


app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid'); // Optional: clears cookie immediately
    res.json({ success: true });
  });
});

// Expense routes
app.get('/expenses', requireAuth, (req, res) => {
  db.all(
    'SELECT * FROM expenses WHERE user_id = ?',
    [req.session.userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(rows);
    }
  );
});

app.post('/expenses', requireAuth, (req, res) => {
  const { amount, category, date, note } = req.body;
  
  db.run(
    'INSERT INTO expenses (user_id, amount, category, date, note) VALUES (?, ?, ?, ?, ?)',
    [req.session.userId, amount, category, date, note],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ id: this.lastID });
    }
  );
});

app.put('/expenses/:id', requireAuth, (req, res) => {
  const { amount, category, date, note } = req.body;
  
  db.run(
    'UPDATE expenses SET amount = ?, category = ?, date = ?, note = ? WHERE id = ? AND user_id = ?',
    [amount, category, date, note, req.params.id, req.session.userId],
    function(err) {
      if (err) return res.status(500).json({ error: 'Update failed' });
      res.json({ success: true });
    }
  );
});

app.delete('/expenses/:id', requireAuth, (req, res) => {
  db.run(
    'DELETE FROM expenses WHERE id = ? AND user_id = ?',
    [req.params.id, req.session.userId],
    function(err) {
      if (err) return res.status(500).json({ error: 'Delete failed' });
      res.json({ success: true });
    }
  );
});

// Analytics routes
app.get('/analytics/total', requireAuth, (req, res) => {
  db.get(
    `SELECT SUM(amount) as total FROM expenses 
     WHERE user_id = ? AND strftime('%m', date) = strftime('%m', 'now')`,
    [req.session.userId],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ total: row?.total || 0 });
    }
  );
});

app.get('/analytics/top-categories', requireAuth, (req, res) => {
  db.all(
    `SELECT category, SUM(amount) as total FROM expenses 
     WHERE user_id = ? AND strftime('%m', date) = strftime('%m', 'now')
     GROUP BY category ORDER BY total DESC LIMIT 3`,
    [req.session.userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(rows || []);
    }
  );
});

app.get('/analytics/pie', requireAuth, (req, res) => {
  db.all(
    `SELECT category, SUM(amount) as total FROM expenses 
     WHERE user_id = ? AND strftime('%m', date) = strftime('%m', 'now')
     GROUP BY category`,
    [req.session.userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(rows || []);
    }
  );
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Endpoints:');
  console.log(`- POST /signup - Create new account`);
  console.log(`- POST /login - Authenticate user`);
  console.log(`- GET /logout - End session`);
  console.log(`- GET /expenses - List all expenses`);
  console.log(`- POST /expenses - Add new expense`);
  console.log(`- PUT /expenses/:id - Update expense`);
  console.log(`- DELETE /expenses/:id - Remove expense`);
});