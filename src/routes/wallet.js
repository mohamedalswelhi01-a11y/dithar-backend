const router = require('express').Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const mypay = require('../services/mypay');

router.use(requireAuth);

router.get('/', async (req, res) => {
  const bal = await db.query('SELECT balance FROM wallets WHERE user_id=$1', [req.user.id]);
  const tx = await db.query(
    'SELECT * FROM wallet_transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',
    [req.user.id]
  );
  res.json({ balance: bal.rows[0]?.balance || 0, transactions: tx.rows });
});

router.post('/topup', async (req, res) => {
  const { amount, provider } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'مبلغ غير صالح' });

  const payment = await db.query(
    `INSERT INTO payments (purpose, user_id, provider, amount, status)
     VALUES ('wallet_topup',$1,$2,$3,'pending') RETURNING *`,
    [req.user.id, provider, amount]
  );
  try {
    const { redirectUrl, providerRef } = await mypay.createPayment({
      amount, method: provider, orderNumber: 'TOPUP-' + payment.rows[0].id.slice(0, 8),
      buyerName: req.user.email, buyerEmail: req.user.email, buyerPhone: req.body.phone || '',
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

module.exports = router;
