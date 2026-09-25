const router = require('express').Router();
const db = require('../config/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.use(requireAuth);

router.post('/', async (req, res) => {
  const { order_id, reason, details } = req.body;
  const order = await db.query('SELECT id FROM orders WHERE id=$1 AND user_id=$2', [order_id, req.user.id]);
  if (!order.rows[0]) return res.status(404).json({ error: 'الطلب غير موجود' });

  const { rows } = await db.query(
    `INSERT INTO returns (order_id, user_id, reason, details) VALUES ($1,$2,$3,$4) RETURNING *`,
    [order_id, req.user.id, reason, details || null]
  );
  res.status(201).json(rows[0]);
});

router.get('/', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM returns WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id]);
  res.json(rows);
});

router.get('/admin/all', requireAdmin, async (req, res) => {
  const { rows } = await db.query(
    `SELECT r.*, o.order_number, u.full_name, u.email FROM returns r
     JOIN orders o ON o.id=r.order_id JOIN users u ON u.id=r.user_id
     ORDER BY r.created_at DESC`
  );
  res.json(rows);
});

router.patch('/:id/status', requireAdmin, async (req, res) => {
  const { rows } = await db.query('UPDATE returns SET status=$1 WHERE id=$2 RETURNING *', [req.body.status, req.params.id]);
  res.json(rows[0]);
});

module.exports = router;
