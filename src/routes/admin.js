const router = require('express').Router();
const db = require('../config/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.use(requireAuth, requireAdmin);

router.get('/dashboard', async (req, res) => {
  const [ordersToday, revenue, lowStock, statusCounts, inventory] = await Promise.all([
    db.query(`SELECT COUNT(*) FROM orders WHERE created_at::date = now()::date`),
    db.query(`SELECT COALESCE(SUM(total),0) AS total FROM orders WHERE payment_status='paid'`),
    db.query(`SELECT COUNT(*) FROM products WHERE stock_qty <= 5 AND status='active'`),
    db.query(`SELECT status, COUNT(*) FROM orders GROUP BY status`),
    db.query(`SELECT status, COUNT(*) FROM products GROUP BY status`),
  ]);
  res.json({
    orders_today: Number(ordersToday.rows[0].count),
    total_revenue: Number(revenue.rows[0].total),
    low_stock_alerts: Number(lowStock.rows[0].count),
    orders_by_status: statusCounts.rows,
    inventory_by_status: inventory.rows,
  });
});

module.exports = router;
