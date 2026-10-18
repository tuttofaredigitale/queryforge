// __tests__/payment.test.js
const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app = require('../backend/app');

// Mock del createCheckout per non chiamare davvero l’API esterna
jest.mock('../backend/utils/lemonSqueezyClient', () => ({
  createCheckout: jest.fn(() =>
    Promise.resolve({
      statusCode: 200,
      error: null,
      data: { attributes: { url: 'https://fake-checkout.url/session' } }
    })
  )
}));

describe('POST /api/payments/create-checkout-session', () => {
  const validToken = jwt.sign(
    { id: 42, role: 'user' },
    process.env.JWT_SECRET || 'your-secret-key'
  );

  it('should return 401 if no Authorization header', async () => {
    const res = await request(app)
      .post('/api/payments/create-checkout-session')
      .send({ variantId: 'ANY' });
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toMatch(/Autenticazione richiesta/);
  });

  it('should return 401 if token is invalid', async () => {
    const res = await request(app)
      .post('/api/payments/create-checkout-session')
      .set('Authorization', 'Bearer invalid.token.here')
      .send({ variantId: 'ANY' });
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toMatch(/Token non valido/);
  });

  it('should return 200 and a url with valid token and body', async () => {
    const res = await request(app)
      .post('/api/payments/create-checkout-session')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ variantId: '781859' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('url', 'https://fake-checkout.url/session');
  });
});
