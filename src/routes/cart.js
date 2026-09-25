const router = require('express').Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', async (req, res) => {
  const { rows } = await db.query(
    `SELECT ci.id, ci.quantity, p.id AS product_id, p.name, p.price,
            (SELECT url FROM product_images WHERE product_id=p.id ORDER BY sort_order LIMIT 1) AS image
     FROM cart_items ci JOIN products p ON p.id = ci.product_id
     WHERE ci.user_id = $1 ORDER BY ci.created_at DESC`,
    [req.user.id]
  );
  const subtotal = rows.reduce((s, r) => s + Number(r.price) * r.quantity, 0);
  res.json({ items: rows, subtotal });
});

router.post('/', async (req, res) => {
  const { product_id, variant_id = null, quantity = 1 } = req.body;
  const { rows } = await db.query(
    `INSERT INTO cart_items (user_id, product_id, variant_id, quantity)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id, product_id, variant_id)
     DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity
     RETURNING *`,
    [req.user.id, product_id, variant_id, quantity]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { rows } = await db.query(
    `UPDATE cart_items SET quantity=$1 WHERE id=$2 AND user_id=$3 RETURNING *`,
    [req.body.quantity, req.params.id, req.user.id]
  );
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  await db.query('DELETE FROM cart_items WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
