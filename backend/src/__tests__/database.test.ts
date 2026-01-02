import { withTransaction, query, createTransactionalQuery } from '../config/database';

describe('Database Transaction Support', () => {
  it('should export withTransaction function', () => {
    expect(typeof withTransaction).toBe('function');
  });

  it('should export query function', () => {
    expect(typeof query).toBe('function');
  });

  it('should export createTransactionalQuery function', () => {
    expect(typeof createTransactionalQuery).toBe('function');
  });
});
