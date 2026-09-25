const router = require('express').Router();
const db = require('../config/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.get('/', async (req, res) => {
  const { rows } = await db.query(
    `SELECT * FROM categories WHERE is_active=true ORDER BY sort_order, name`
  );
  res.json(rows);
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { name, slug, icon, parent_id, sort_order } = req.body;
  if (!name || !slug) return res.status(400).json({ error: 'الاسم والمعرف مطلوبان' });
  const { rows } = await db.query(
    `INSERT INTO categories (name, slug, icon, parent_id, sort_order)
     VALUES ($1,$2,$3,$4,COALESCE($5,0)) RETURNING *`,
    [name, slug, icon || null, parent_id || null, sort_order]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { name, icon, sort_order, is_active } = req.body;
  const { rows } = await db.query(
    `UPDATE categories SET name=COALESCE($1,name), icon=COALESCE($2,icon),
     sort_order=COALESCE($3,sort_order), is_active=COALESCE($4,is_active)
     WHERE id=$5 RETURNING *`,
    [name, icon, sort_order, is_active, req.params.id]
  );
  res.json(rows[0]);
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  await db.query('DELETE FROM categories WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
