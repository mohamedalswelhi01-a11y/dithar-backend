const router = require('express').Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM addresses WHERE user_id=$1 ORDER BY is_default DESC', [req.user.id]
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { label, city, district, details, phone, is_default } = req.body;
  if (!city) return res.status(400).json({ error: 'المدينة مطلوبة' });
  if (is_default) await db.query('UPDATE addresses SET is_default=false WHERE user_id=$1', [req.user.id]);
  const { rows } = await db.query(
    `INSERT INTO addresses (user_id,label,city,district,details,phone,is_default)
     VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,false)) RETURNING *`,
    [req.user.id, label || null, city, district || null, details || null, phone || null, is_default]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { label, city, district, details, phone, is_default } = req.body;
  if (is_default) await db.query('UPDATE addresses SET is_default=false WHERE user_id=$1', [req.user.id]);
  const { rows } = await db.query(
    `UPDATE addresses SET label=COALESCE($1,label), city=COALESCE($2,city), district=COALESCE($3,district),
       details=COALESCE($4,details), phone=COALESCE($5,phone), is_default=COALESCE($6,is_default)
     WHERE id=$7 AND user_id=$8 RETURNING *`,
    [label, city, district, details, phone, is_default, req.params.id, req.user.id]
  );
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  await db.query('DELETE FROM addresses WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
