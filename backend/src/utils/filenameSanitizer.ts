/**
 * Sanitize filename for use in Content-Disposition header
 * Prevents HTTP header injection and removes unsafe characters
 */

const DEFAULT_FILENAME = 'download';

/**
 * Sanitize a filename to prevent HTTP header injection attacks
 * and ensure safe filesystem compatibility
 *
 * @param filename - The filename to sanitize
 * @returns A safe filename string
 */
export const sanitizeFilename = (filename: string): string => {
  // Handle null, undefined, or non-string input
  if (!filename || typeof filename !== 'string') {
    return DEFAULT_FILENAME;
  }

  let sanitized = filename;

  // Remove ASCII control characters (0-31) and DEL (127) including tab, CR, LF
  // This prevents HTTP header injection via CRLF
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

  // Remove characters that are problematic in filenames or headers:
  // - Double quotes (") - used to delimit filename in header
  // - Backslash (\) - escape character, path separator on Windows
  // - Forward slash (/) - path separator on Unix
  // - Colon (:) - drive separator on Windows, protocol separator
  // - Angle brackets (<>) - HTML/shell special characters
  // - Pipe (|) - shell special character
  // - Question mark (?) - wildcard, query string delimiter
  // - Asterisk (*) - wildcard character
  sanitized = sanitized.replace(/["\\/:<>|?*]/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Return default if filename is empty after sanitization
  if (!sanitized) {
    return DEFAULT_FILENAME;
  }

  return sanitized;
};

export default { sanitizeFilename };
