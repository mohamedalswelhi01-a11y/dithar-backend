const router = require('express').Router();
const db = require('../config/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.get('/', async (req, res) => {
  const { category, featured, bestseller, status, search, page = 1, limit = 20 } = req.query;
  const where = [];
  const params = [];
  where.push(`status = 'active'`);
  if (category) { params.push(category); where.push(`category_id = $${params.length}`); }
  if (featured) { where.push(`is_featured = true`); }
  if (bestseller) { where.push(`is_bestseller = true`); }
  if (search) { params.push(`%${search}%`); where.push(`name ILIKE $${params.length}`); }

  const offset = (Number(page) - 1) * Number(limit);
  params.push(limit, offset);
  const { rows } = await db.query(
    `SELECT p.*, c.name AS category_name,
       COALESCE(json_agg(pi.url) FILTER (WHERE pi.url IS NOT NULL), '[]') AS images
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN product_images pi ON pi.product_id = p.id
     WHERE ${where.join(' AND ')}
     GROUP BY p.id, c.name
     ORDER BY p.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const { rows } = await db.query(
    `SELECT p.*, COALESCE(json_agg(DISTINCT pi.url) FILTER (WHERE pi.url IS NOT NULL), '[]') AS images,
       COALESCE(json_agg(DISTINCT jsonb_build_object('id',v.id,'size',v.size,'color',v.color,'stock',v.stock_qty))
                 FILTER (WHERE v.id IS NOT NULL), '[]') AS variants
     FROM products p
     LEFT JOIN product_images pi ON pi.product_id = p.id
     LEFT JOIN product_variants v ON v.product_id = p.id
     WHERE p.id=$1 GROUP BY p.id`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'المنتج غير موجود' });
  res.json(rows[0]);
});

router.get('/admin/all', requireAuth, requireAdmin, async (req, res) => {
  const { status } = req.query;
  const q = status
    ? await db.query('SELECT * FROM products WHERE status=$1 ORDER BY created_at DESC', [status])
    : await db.query('SELECT * FROM products ORDER BY created_at DESC');
  res.json(q.rows);
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { category_id, name, description, sku, price, compare_price, stock_qty, is_featured, images } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'الاسم والسعر مطلوبان' });
  const { rows } = await db.query(
    `INSERT INTO products (category_id,name,description,sku,price,compare_price,stock_qty,is_featured,status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8, CASE WHEN COALESCE($7,0)>0 THEN 'active' ELSE 'out_of_stock' END)
     RETURNING *`,
    [category_id, name, description, sku, price, compare_price || null, stock_qty || 0, !!is_featured]
  );
  const product = rows[0];
  if (Array.isArray(images)) {
    for (const [i, url] of images.entries()) {
      await db.query('INSERT INTO product_images (product_id, url, sort_order) VALUES ($1,$2,$3)', [product.id, url, i]);
    }
  }
  res.status(201).json(product);
});

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { name, price, compare_price, stock_qty, status, is_featured, is_bestseller } = req.body;
  const { rows } = await db.query(
    `UPDATE products SET
       name=COALESCE($1,name), price=COALESCE($2,price), compare_price=COALESCE($3,compare_price),
       stock_qty=COALESCE($4,stock_qty), status=COALESCE($5,status),
       is_featured=COALESCE($6,is_featured), is_bestseller=COALESCE($7,is_bestseller),
       updated_at=now()
     WHERE id=$8 RETURNING *`,
    [name, price, compare_price, stock_qty, status, is_featured, is_bestseller, req.params.id]
  );
  res.json(rows[0]);
});

router.patch('/:id/archive', requireAuth, requireAdmin, async (req, res) => {
  await db.query(`UPDATE products SET status='archived' WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
});
router.patch('/:id/restore', requireAuth, requireAdmin, async (req, res) => {
  await db.query(`UPDATE products SET status='active' WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
