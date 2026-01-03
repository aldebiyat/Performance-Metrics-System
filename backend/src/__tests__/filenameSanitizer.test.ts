import { sanitizeFilename } from '../utils/filenameSanitizer';

describe('Filename Sanitizer', () => {
  describe('sanitizeFilename', () => {
    describe('control character removal', () => {
      it('should remove ASCII control characters (0-31)', () => {
        // Test various control characters
        expect(sanitizeFilename('file\x00name.csv')).toBe('filename.csv');
        expect(sanitizeFilename('file\x1Fname.csv')).toBe('filename.csv');
        expect(sanitizeFilename('\x01\x02\x03test.pdf')).toBe('test.pdf');
      });

      it('should remove tab characters', () => {
        expect(sanitizeFilename('file\tname.csv')).toBe('filename.csv');
      });

      it('should remove DEL character (0x7F)', () => {
        expect(sanitizeFilename('file\x7Fname.csv')).toBe('filename.csv');
      });
    });

    describe('CRLF removal (header injection prevention)', () => {
      it('should remove carriage return characters', () => {
        expect(sanitizeFilename('file\rname.csv')).toBe('filename.csv');
      });

      it('should remove newline characters', () => {
        expect(sanitizeFilename('file\nname.csv')).toBe('filename.csv');
      });

      it('should remove CRLF sequences', () => {
        expect(sanitizeFilename('file\r\nname.csv')).toBe('filename.csv');
      });

      it('should prevent HTTP header injection attempts', () => {
        // Attempt to inject a new header via filename
        const malicious = 'file.csv\r\nContent-Type: text/html\r\n\r\n<script>alert(1)</script>';
        const result = sanitizeFilename(malicious);
        expect(result).not.toContain('\r');
        expect(result).not.toContain('\n');
        // Colons and angle brackets are removed, spaces and parentheses are preserved
        expect(result).toBe('file.csvContent-Type texthtmlscriptalert(1)script');
      });
    });

    describe('quote and backslash handling', () => {
      it('should remove double quotes', () => {
        expect(sanitizeFilename('file"name.csv')).toBe('filename.csv');
        expect(sanitizeFilename('"filename".csv')).toBe('filename.csv');
      });

      it('should remove backslashes', () => {
        expect(sanitizeFilename('file\\name.csv')).toBe('filename.csv');
        expect(sanitizeFilename('path\\to\\file.csv')).toBe('pathtofile.csv');
      });

      it('should handle multiple quotes and backslashes', () => {
        expect(sanitizeFilename('"""test""".csv')).toBe('test.csv');
        expect(sanitizeFilename('\\\\\\test\\\\\\.csv')).toBe('test.csv');
      });
    });

    describe('valid filename passthrough', () => {
      it('should pass through valid simple filenames unchanged', () => {
        expect(sanitizeFilename('report.csv')).toBe('report.csv');
        expect(sanitizeFilename('metrics-report.pdf')).toBe('metrics-report.pdf');
        expect(sanitizeFilename('export_2024-01-15.csv')).toBe('export_2024-01-15.csv');
      });

      it('should preserve safe special characters', () => {
        expect(sanitizeFilename('file-name_v1.2.csv')).toBe('file-name_v1.2.csv');
        expect(sanitizeFilename('report (1).pdf')).toBe('report (1).pdf');
      });

      it('should preserve typical export filenames from exportService', () => {
        // These are the actual patterns used by exportService
        expect(sanitizeFilename('metrics-all-7d-2024-01-15.csv')).toBe('metrics-all-7d-2024-01-15.csv');
        expect(sanitizeFilename('metrics-report-performance-30d-2024-01-15.pdf')).toBe('metrics-report-performance-30d-2024-01-15.pdf');
      });
    });

    describe('empty and malicious input handling', () => {
      it('should return safe default for empty string', () => {
        expect(sanitizeFilename('')).toBe('download');
      });

      it('should return safe default for string that becomes empty after sanitization', () => {
        expect(sanitizeFilename('\r\n\t')).toBe('download');
        expect(sanitizeFilename('"""')).toBe('download');
        expect(sanitizeFilename('\x00\x01\x02')).toBe('download');
      });

      it('should return safe default for null/undefined input', () => {
        expect(sanitizeFilename(null as unknown as string)).toBe('download');
        expect(sanitizeFilename(undefined as unknown as string)).toBe('download');
      });

      it('should handle path traversal attempts', () => {
        expect(sanitizeFilename('../../../etc/passwd')).toBe('......etcpasswd');
        expect(sanitizeFilename('..\\..\\..\\windows\\system32')).toBe('......windowssystem32');
      });
    });

    describe('additional dangerous characters', () => {
      it('should remove forward slashes', () => {
        expect(sanitizeFilename('path/to/file.csv')).toBe('pathtofile.csv');
      });

      it('should remove colons', () => {
        expect(sanitizeFilename('C:file.csv')).toBe('Cfile.csv');
      });

      it('should remove angle brackets', () => {
        expect(sanitizeFilename('file<script>.csv')).toBe('filescript.csv');
      });

      it('should remove pipe character', () => {
        expect(sanitizeFilename('file|name.csv')).toBe('filename.csv');
      });

      it('should remove question mark and asterisk', () => {
        expect(sanitizeFilename('file?.csv')).toBe('file.csv');
        expect(sanitizeFilename('file*.csv')).toBe('file.csv');
      });
    });
  });
});
