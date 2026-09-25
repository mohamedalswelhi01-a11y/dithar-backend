const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const mypay = require('../services/mypay');

router.post('/initiate', requireAuth, async (req, res) => {
  const { order_id, provider } = req.body;
  const order = await db.query('SELECT * FROM orders WHERE id=$1 AND user_id=$2', [order_id, req.user.id]);
  if (!order.rows[0]) return res.status(404).json({ error: 'الطلب غير موجود' });

  const payment = await db.query(
    `INSERT INTO payments (order_id, provider, amount, status) VALUES ($1,$2,$3,'pending') RETURNING *`,
    [order_id, provider, order.rows[0].total]
  );

  try {
    const { redirectUrl, providerRef } = await mypay.createPayment({
      amount: order.rows[0].total,
      method: provider,
      orderNumber: order.rows[0].order_number,
      buyerName: req.user.email,
      buyerEmail: req.user.email,
      buyerPhone: req.body.phone || '',
      webhookUrl: `${process.env.PUBLIC_BACKEND_URL || ''}/api/payments/webhook`,
      returnUrl: req.body.return_url || '',
    });
    await db.query('UPDATE payments SET provider_ref=$1 WHERE id=$2', [providerRef, payment.rows[0].id]);
    res.json({ payment_id: payment.rows[0].id, redirect_url: redirectUrl });
  } catch (e) {
    await db.query(`UPDATE payments SET status='failed' WHERE id=$1`, [payment.rows[0].id]);
    res.status(502).json({ error: e.message || 'تعذّر الاتصال ببوابة الدفع' });
  }
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-mypay-signature'];
  const valid = mypay.verifyWebhookSignature(req.body, signature);
  if (!valid) return res.status(401).json({ error: 'توقيع غير صالح' });

  const payload = JSON.parse(req.body.toString('utf8'));
  const { payment_id, provider_ref, status } = payload;

  const success = status === 'paid' || status === 'success';
  const payment = await db.query(
    `UPDATE payments SET status=$1, provider_ref=COALESCE($2,provider_ref), raw_response=$3
     WHERE (provider_ref=$4 OR id=$4) AND status='pending' RETURNING *`,
    [success ? 'success' : 'failed', provider_ref, payload, payment_id]
  );
  const p = payment.rows[0];
  if (p && success) {
    if (p.purpose === 'wallet_topup') {
      await db.query('UPDATE wallets SET balance = balance + $1 WHERE user_id=$2', [p.amount, p.user_id]);
      await db.query(
        `INSERT INTO wallet_transactions (user_id, amount, type, reference) VALUES ($1,$2,'topup',$3)`,
        [p.user_id, p.amount, p.provider_ref]
      );
    } else {
      await db.query(`UPDATE orders SET payment_status='paid' WHERE id=$1`, [p.order_id]);
    }
  }
  res.json({ received: true });
});

module.exports = router;
