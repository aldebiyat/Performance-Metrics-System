/**
 * Sanitize strings for safe logging
 * Removes newlines, control characters, and ANSI escape sequences
 */
export const sanitizeForLog = (value: string, maxLength = 200): string => {
  if (!value) return '';

  return value
    // Remove ANSI escape sequences
    .replace(/\x1b\[[0-9;]*m/g, '')
    // Remove newlines and carriage returns
    .replace(/[\r\n]/g, ' ')
    // Remove other control characters
    .replace(/[\x00-\x1f\x7f]/g, '')
    // Truncate to max length
    .substring(0, maxLength);
};

export default { sanitizeForLog };
