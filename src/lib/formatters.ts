/**
 * Format a number as currency (ETB - Ethiopian Birr)
 */
export const formatCurrency = (amount?: number | null): string => {
  if (amount === undefined || amount === null) {
    console.log('[Formatter] Received null/undefined amount');
    return 'ETB 0';
  }
  
  // Log the incoming amount
  console.log('[Formatter] Raw amount:', amount);
  console.log('[Formatter] Amount type:', typeof amount);
  console.log('[Formatter] Amount toString():', amount.toString());
  
  // Create the formatter
  const formatter = new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  
  // Format the amount
  const formatted = formatter.format(amount);
  console.log('[Formatter] Formatted result:', formatted);
  
  return formatted;
};

/**
 * Create a URL-friendly slug from a string
 */
export const createSlug = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars
    .replace(/\s+/g, '-')     // Replace spaces with dashes
    .replace(/-+/g, '-')      // Replace multiple dashes with single dash
    .trim();
};

/**
 * Format a date string
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
};
