const app = require('./app');
const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => console.log(`🟢 dithar-backend يعمل على المنفذ ${PORT}`));
