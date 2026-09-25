const router = require('express').Router();
const db = require('../config/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.use(requireAuth);

function genOrderNumber() {
  return 'DTH' + Date.now().toString().slice(-8);
}

router.post('/', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { address_id, payment_method, notes } = req.body;
    await client.query('BEGIN');

    const cartRes = await client.query(
      `SELECT ci.product_id, ci.variant_id, ci.quantity, p.name, p.price, p.stock_qty
       FROM cart_items ci JOIN products p ON p.id=ci.product_id WHERE ci.user_id=$1`,
      [req.user.id]
    );
    if (!cartRes.rows.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'السلة فارغة' }); }

    for (const item of cartRes.rows) {
      if (item.stock_qty < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `الكمية غير متوفرة لمنتج: ${item.name}` });
      }
    }

    const subtotal = cartRes.rows.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
    const shipping = Number(process.env.SHIPPING_FEE_DEFAULT || 15);
    const total = subtotal + shipping;
    const orderNumber = genOrderNumber();

    const orderRes = await client.query(
      `INSERT INTO orders (order_number,user_id,address_id,subtotal,shipping_fee,total,payment_method,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [orderNumber, req.user.id, address_id || null, subtotal, shipping, total, payment_method, notes || null]
    );
    const order = orderRes.rows[0];

    for (const item of cartRes.rows) {
      await client.query(
        `INSERT INTO order_items (order_id,product_id,variant_id,product_name,unit_price,quantity)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [order.id, item.product_id, item.variant_id, item.name, item.price, item.quantity]
      );
      await client.query(
        `UPDATE products SET stock_qty = stock_qty - $1, sold_count = sold_count + $1,
           status = CASE WHEN stock_qty - $1 <= 0 THEN 'out_of_stock' ELSE status END
         WHERE id=$2`,
        [item.quantity, item.product_id]
      );
    }

    if (payment_method === 'wallet') {
      const w = await client.query('SELECT balance FROM wallets WHERE user_id=$1 FOR UPDATE', [req.user.id]);
      if (!w.rows.length || Number(w.rows[0].balance) < total) {
        await client.query('ROLLBACK');
        return res.status(402).json({ error: 'رصيد المحفظة غير كافٍ' });
      }
      await client.query('UPDATE wallets SET balance = balance - $1 WHERE user_id=$2', [total, req.user.id]);
      await client.query(
        `INSERT INTO wallet_transactions (user_id,amount,type,reference) VALUES ($1,$2,'order_payment',$3)`,
        [req.user.id, -total, orderNumber]
      );
      await client.query(`UPDATE orders SET payment_status='paid' WHERE id=$1`, [order.id]);
    }

    await client.query('DELETE FROM cart_items WHERE user_id=$1', [req.user.id]);
    await client.query('COMMIT');
    res.status(201).json(order);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'تعذّر إتمام الطلب', details: e.message });
  } finally {
    client.release();
  }
});

router.get('/', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM orders WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id]);
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const order = await db.query('SELECT * FROM orders WHERE id=$1 AND (user_id=$2 OR $3)', [
    req.params.id, req.user.id, ['admin', 'super_admin'].includes(req.user.role),
  ]);
  if (!order.rows[0]) return res.status(404).json({ error: 'الطلب غير موجود' });
  const items = await db.query('SELECT * FROM order_items WHERE order_id=$1', [req.params.id]);
  res.json({ ...order.rows[0], items: items.rows });
});

router.get('/admin/all', requireAdmin, async (req, res) => {
  const { status } = req.query;
  const q = status
    ? await db.query('SELECT * FROM orders WHERE status=$1 ORDER BY created_at DESC', [status])
    : await db.query('SELECT * FROM orders ORDER BY created_at DESC');
  res.json(q.rows);
});

router.patch('/:id/status', requireAdmin, async (req, res) => {
  const { rows } = await db.query(
    `UPDATE orders SET status=$1, updated_at=now() WHERE id=$2 RETURNING *`,
    [req.body.status, req.params.id]
  );
  res.json(rows[0]);
});

module.exports = router;
