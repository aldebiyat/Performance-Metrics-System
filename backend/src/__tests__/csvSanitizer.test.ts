import { escapeCSVFormula, sanitizeForCSV } from '../utils/csvSanitizer';

describe('CSV Sanitizer', () => {
  describe('escapeCSVFormula', () => {
    it('should prefix formula-starting characters with single quote', () => {
      expect(escapeCSVFormula('=SUM(A1)')).toBe("'=SUM(A1)");
      expect(escapeCSVFormula('+1234')).toBe("'+1234");
      expect(escapeCSVFormula('-1234')).toBe("'-1234");
      expect(escapeCSVFormula('@mention')).toBe("'@mention");
      expect(escapeCSVFormula('\tvalue')).toBe("'\tvalue");
    });

    it('should not modify safe values', () => {
      expect(escapeCSVFormula('Normal text')).toBe('Normal text');
      expect(escapeCSVFormula('123456')).toBe('123456');
    });

    it('should handle empty and null values', () => {
      expect(escapeCSVFormula('')).toBe('');
      expect(escapeCSVFormula(null as unknown as string)).toBe(null);
    });
  });

  describe('sanitizeForCSV', () => {
    it('should escape quotes and formulas', () => {
      expect(sanitizeForCSV('Test "value"')).toBe('"Test ""value"""');
      expect(sanitizeForCSV('=FORMULA')).toBe("\"'=FORMULA\"");
    });

    it('should handle empty values', () => {
      expect(sanitizeForCSV('')).toBe('""');
    });
  });
});
