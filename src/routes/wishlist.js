const router = require('express').Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', async (req, res) => {
  const { rows } = await db.query(
    `SELECT p.* FROM wishlist_items w JOIN products p ON p.id = w.product_id
     WHERE w.user_id=$1 ORDER BY w.created_at DESC`,
    [req.user.id]
  );
  res.json(rows);
});

router.post('/:productId', async (req, res) => {
  const { rows } = await db.query(
    'SELECT 1 FROM wishlist_items WHERE user_id=$1 AND product_id=$2',
    [req.user.id, req.params.productId]
  );
  if (rows.length) {
    await db.query('DELETE FROM wishlist_items WHERE user_id=$1 AND product_id=$2', [req.user.id, req.params.productId]);
    return res.json({ inWishlist: false });
  }
  await db.query('INSERT INTO wishlist_items (user_id, product_id) VALUES ($1,$2)', [req.user.id, req.params.productId]);
  res.json({ inWishlist: true });
});

module.exports = router;
