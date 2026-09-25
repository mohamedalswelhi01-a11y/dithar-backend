const router = require('express').Router();
const db = require('../config/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.get('/', async (req, res) => {
  const { rows } = await db.query(
    `SELECT * FROM banners
     WHERE is_active = true
       AND (starts_at IS NULL OR starts_at <= now())
       AND (ends_at   IS NULL OR ends_at   >= now())
     ORDER BY sort_order, id`
  );
  res.json(rows);
});

router.get('/admin/all', requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM banners ORDER BY sort_order, id');
  res.json(rows);
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { title, subtitle, image_url, link_url, sort_order, starts_at, ends_at } = req.body;
  const { rows } = await db.query(
    `INSERT INTO banners (title,subtitle,image_url,link_url,sort_order,starts_at,ends_at)
     VALUES ($1,$2,$3,$4,COALESCE($5,0),$6,$7) RETURNING *`,
    [title, subtitle || null, image_url || null, link_url || null, sort_order, starts_at || null, ends_at || null]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { title, subtitle, image_url, link_url, sort_order, is_active, starts_at, ends_at } = req.body;
  const { rows } = await db.query(
    `UPDATE banners SET title=COALESCE($1,title), subtitle=COALESCE($2,subtitle),
       image_url=COALESCE($3,image_url), link_url=COALESCE($4,link_url),
       sort_order=COALESCE($5,sort_order), is_active=COALESCE($6,is_active),
       starts_at=COALESCE($7,starts_at), ends_at=COALESCE($8,ends_at)
     WHERE id=$9 RETURNING *`,
    [title, subtitle, image_url, link_url, sort_order, is_active, starts_at, ends_at, req.params.id]
  );
  res.json(rows[0]);
});

router.patch('/:id/toggle', requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await db.query(
    `UPDATE banners SET is_active = NOT is_active WHERE id=$1 RETURNING *`, [req.params.id]
  );
  res.json(rows[0]);
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  await db.query('DELETE FROM banners WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
