import express from 'express';
import request from 'supertest';
import fs from 'fs/promises';
import securityRoutes from '../../routes/security';

jest.mock('fs/promises');

const mockFs = fs as jest.Mocked<typeof fs>;

const validSecurityTxt = `Contact: mailto:security@example.com\r
Expires: 2027-01-03T00:00:00.000Z\r
Preferred-Languages: en\r
Canonical: https://example.com/.well-known/security.txt\r
Policy: https://example.com/security-policy\r
`;

describe('Security.txt Route', () => {
  let app: express.Express;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.readFile.mockResolvedValue(validSecurityTxt);
    app = express();
    app.use(securityRoutes);
  });

  describe('GET /.well-known/security.txt', () => {
    it('should return security.txt content with 200 status', async () => {
      const response = await request(app).get('/.well-known/security.txt');

      expect(response.status).toBe(200);
      expect(response.type).toBe('text/plain');
    });

    it('should contain required Contact field', async () => {
      const response = await request(app).get('/.well-known/security.txt');

      expect(response.text).toMatch(/^Contact: mailto:/m);
    });

    it('should contain required Expires field with valid date', async () => {
      const response = await request(app).get('/.well-known/security.txt');

      expect(response.text).toMatch(/^Expires: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/m);

      // Extract the expires date and verify it's in the future
      const expiresMatch = response.text.match(/^Expires: (.+)$/m);
      expect(expiresMatch).toBeTruthy();
      if (expiresMatch) {
        const expiresDate = new Date(expiresMatch[1]);
        expect(expiresDate.getTime()).toBeGreaterThan(Date.now());
      }
    });

    it('should contain Preferred-Languages field', async () => {
      const response = await request(app).get('/.well-known/security.txt');

      expect(response.text).toMatch(/^Preferred-Languages: en/m);
    });

    it('should be accessible without authentication', async () => {
      // No auth headers sent, should still work
      const response = await request(app).get('/.well-known/security.txt');

      expect(response.status).toBe(200);
    });

    it('should follow RFC 9116 format with proper line endings', async () => {
      const response = await request(app).get('/.well-known/security.txt');

      // Each field should be on its own line
      const lines = response.text.split('\n').filter(line => line.trim());
      expect(lines.length).toBeGreaterThanOrEqual(3); // At minimum: Contact, Expires, Preferred-Languages
    });

    it('should return 404 when security.txt file is not found', async () => {
      const notFoundError = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
      notFoundError.code = 'ENOENT';
      mockFs.readFile.mockRejectedValue(notFoundError);

      const response = await request(app).get('/.well-known/security.txt');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: 'security.txt not found',
      });
    });

    it('should return 500 when file read fails for other reasons', async () => {
      const readError = new Error('Permission denied') as NodeJS.ErrnoException;
      readError.code = 'EACCES';
      mockFs.readFile.mockRejectedValue(readError);

      const response = await request(app).get('/.well-known/security.txt');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Failed to read security.txt',
      });
    });
  });
});
