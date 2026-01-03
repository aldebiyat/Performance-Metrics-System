import { loginAttemptService } from '../../services/loginAttemptService';
import { query } from '../../config/database';

jest.mock('../../config/database');

describe('loginAttemptService fail-closed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return locked true with remainingMinutes when database query fails', async () => {
    (query as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

    const result = await loginAttemptService.isLocked('test@example.com');

    // Should fail-closed: treat as locked when cannot verify
    expect(result.locked).toBe(true);
    // Should include remainingMinutes for proper error messaging
    expect(result.remainingMinutes).toBe(15);
  });

  it('should return locked false when database is available and user not locked out', async () => {
    // User not locked out - below MAX_ATTEMPTS (5)
    (query as jest.Mock).mockResolvedValue({
      rows: [{ attempt_count: '2', last_attempt: null }],
      rowCount: 1,
    });

    const result = await loginAttemptService.isLocked('test@example.com');
    expect(result.locked).toBe(false);
  });
});

describe('loginAttemptService SQL safety', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('should use parameterized INTERVAL in isLocked query', async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [{ attempt_count: '0', last_attempt: null }], rowCount: 1 });

    await loginAttemptService.isLocked('test@example.com');

    const calls = (query as jest.Mock).mock.calls;
    const sqlCall = calls.find(call => call[0].includes('attempted_at'));

    // Should use INTERVAL with parameter, not string interpolation
    expect(sqlCall[0]).toContain("INTERVAL '1 minute' *");
    expect(sqlCall[0]).not.toMatch(/INTERVAL '\$\{/);
  });

  it('should use parameterized INTERVAL in getAttemptCount query', async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [{ count: '0' }], rowCount: 1 });

    await loginAttemptService.getAttemptCount('test@example.com');

    const calls = (query as jest.Mock).mock.calls;
    const sqlCall = calls.find(call => call[0].includes('COUNT'));

    expect(sqlCall[0]).toContain("INTERVAL '1 minute' *");
    expect(sqlCall[0]).not.toMatch(/INTERVAL '\$\{/);
  });

  it('should pass LOCKOUT_MINUTES as a query parameter in isLocked', async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [{ attempt_count: '0', last_attempt: null }], rowCount: 1 });

    await loginAttemptService.isLocked('test@example.com');

    const calls = (query as jest.Mock).mock.calls;
    const sqlCall = calls.find(call => call[0].includes('attempted_at'));

    // Should have 2 parameters: email and LOCKOUT_MINUTES
    expect(sqlCall[1]).toHaveLength(2);
    expect(sqlCall[1][0]).toBe('test@example.com');
    expect(typeof sqlCall[1][1]).toBe('number');
  });

  it('should pass LOCKOUT_MINUTES as a query parameter in getAttemptCount', async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [{ count: '0' }], rowCount: 1 });

    await loginAttemptService.getAttemptCount('test@example.com');

    const calls = (query as jest.Mock).mock.calls;
    const sqlCall = calls.find(call => call[0].includes('COUNT'));

    // Should have 2 parameters: email and LOCKOUT_MINUTES
    expect(sqlCall[1]).toHaveLength(2);
    expect(sqlCall[1][0]).toBe('test@example.com');
    expect(typeof sqlCall[1][1]).toBe('number');
  });
});
