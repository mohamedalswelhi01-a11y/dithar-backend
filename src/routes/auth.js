const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

function sign(user) {
  return jwt.sign({ id: user.id, role: user.role, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
}

router.post('/register', async (req, res) => {
  const { full_name, email, phone, password } = req.body;
  if (!full_name || !email || !password) return res.status(400).json({ error: 'الاسم والبريد وكلمة المرور مطلوبة' });

  const exists = await db.query('SELECT id FROM users WHERE email=$1', [email]);
  if (exists.rows.length) return res.status(409).json({ error: 'هذا البريد مسجّل مسبقًا' });

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await db.query(
    `INSERT INTO users (full_name, email, phone, password_hash) VALUES ($1,$2,$3,$4)
     RETURNING id, full_name, email, role`,
    [full_name, email, phone || null, hash]
  );
  await db.query('INSERT INTO wallets (user_id, balance) VALUES ($1, 0)', [rows[0].id]);

  res.status(201).json({ token: sign(rows[0]), user: rows[0] });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await db.query('SELECT * FROM users WHERE email=$1 AND is_active=true', [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'البريد أو كلمة المرور غير صحيحة' });
  }
  res.json({
    token: sign(user),
    user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role },
  });
});

module.exports = router;
