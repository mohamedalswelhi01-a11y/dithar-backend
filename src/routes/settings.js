const router = require('express').Router();
const db = require('../config/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.get('/', async (req, res) => {
  const { rows } = await db.query('SELECT key, value FROM settings');
  const out = {};
  rows.forEach(r => { out[r.key] = r.value; });
  res.json(out);
});

router.put('/:key', requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await db.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1,$2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
     RETURNING *`,
    [req.params.key, req.body]
  );
  res.json(rows[0]);
});

module.exports = router;
