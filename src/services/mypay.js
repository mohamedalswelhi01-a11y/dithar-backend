const crypto = require('crypto');

const BASE_URL = process.env.MYPAY_ENV === 'production'
  ? 'https://mypay.ly/pay/api/v1'
  : 'https://mypay.ly/pay/sandbox/api/v1';

let cachedToken = null, tokenExpiry = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const res = await fetch(`${BASE_URL}/authentication/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.MYPAY_CLIENT_ID,
      secret_id: process.env.MYPAY_SECRET_ID,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'تعذّر الاتصال ببوابة الدفع');
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (Number(data.expires_in || 3000) * 1000) - 30000;
  return cachedToken;
}

async function createPayment({ amount, currency = 'LYD', method, orderNumber, buyerName, buyerEmail, buyerPhone, webhookUrl, returnUrl }) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}/payment/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      amount, currency, payment_method: method,
      reference: orderNumber,
      billing: { name: buyerName, email: buyerEmail, phone: buyerPhone },
      webhook_url: webhookUrl,
      return_url: returnUrl,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'تعذّر إنشاء عملية الدفع');
  return { redirectUrl: data.checkout_url || data.redirect_url, providerRef: data.payment_id || data.id };
}

function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!process.env.MYPAY_WEBHOOK_SECRET || !signatureHeader) return false;
  const expected = crypto
    .createHmac('sha256', process.env.MYPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
}

module.exports = { createPayment, verifyWebhookSignature };
