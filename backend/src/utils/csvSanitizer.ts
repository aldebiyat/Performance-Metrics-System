/**
 * Escape CSV formula injection attacks
 * Prefixes dangerous characters with a single quote to prevent
 * Excel/LibreOffice from interpreting them as formulas
 */
export const escapeCSVFormula = (value: string): string => {
  if (!value) return value;

  // Characters that can start a formula in spreadsheet apps
  const dangerousChars = ['=', '+', '-', '@', '\t', '\r', '\n'];

  if (dangerousChars.some(char => value.startsWith(char))) {
    return `'${value}`;
  }

  return value;
};

/**
 * Full CSV sanitization: escape quotes and formulas
 */
export const sanitizeForCSV = (value: string): string => {
  if (!value) return '""';

  // First escape formulas
  let sanitized = escapeCSVFormula(value);

  // Then escape double quotes and wrap in quotes
  sanitized = sanitized.replace(/"/g, '""');

  return `"${sanitized}"`;
};

export default { escapeCSVFormula, sanitizeForCSV };
