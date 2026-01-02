/**
 * Sanitize string input by removing HTML and limiting length
 */
export const sanitizeInput = (value: string, maxLength = 255): string => {
  if (!value) return '';

  return value
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove null bytes
    .replace(/\0/g, '')
    // Trim whitespace
    .trim()
    // Limit length
    .substring(0, maxLength);
};

export default { sanitizeInput };
