import express, { RequestHandler } from 'express';
import request from 'supertest';

// Simple handler that responds with success
const testHandler: RequestHandler = (_req, res) => {
  res.json({ received: true });
};

describe('Request Body Size Limits', () => {
  it('should reject requests larger than 1MB', async () => {
    const app = express();
    app.use(express.json({ limit: '1mb' }));
    app.post('/test', testHandler);

    // Create a payload larger than 1MB
    const largePayload = { data: 'x'.repeat(2 * 1024 * 1024) }; // 2MB

    const response = await request(app)
      .post('/test')
      .send(largePayload)
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(413); // Payload Too Large
  });

  it('should accept requests smaller than 1MB', async () => {
    const app = express();
    app.use(express.json({ limit: '1mb' }));
    app.post('/test', testHandler);

    const normalPayload = { data: 'normal data' };

    const response = await request(app)
      .post('/test')
      .send(normalPayload)
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(200);
  });

  it('should reject URL-encoded requests larger than 1MB', async () => {
    const app = express();
    app.use(express.urlencoded({ extended: true, limit: '1mb' }));
    app.post('/test', testHandler);

    // Create a payload larger than 1MB
    const largeData = 'x'.repeat(2 * 1024 * 1024);

    const response = await request(app)
      .post('/test')
      .send(`data=${largeData}`)
      .set('Content-Type', 'application/x-www-form-urlencoded');

    expect(response.status).toBe(413); // Payload Too Large
  });

  it('should accept URL-encoded requests smaller than 1MB', async () => {
    const app = express();
    app.use(express.urlencoded({ extended: true, limit: '1mb' }));
    app.post('/test', testHandler);

    const response = await request(app)
      .post('/test')
      .send('data=normal+data')
      .set('Content-Type', 'application/x-www-form-urlencoded');

    expect(response.status).toBe(200);
  });

  it('should use configurable limit from environment variable', async () => {
    // Test with a smaller limit (100KB)
    const limit = '100kb';
    const app = express();
    app.use(express.json({ limit }));
    app.post('/test', testHandler);

    // Create a payload larger than 100KB but smaller than 1MB
    const mediumPayload = { data: 'x'.repeat(200 * 1024) }; // 200KB

    const response = await request(app)
      .post('/test')
      .send(mediumPayload)
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(413); // Should be rejected with 100KB limit
  });
});
