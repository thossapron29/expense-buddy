import { findCategory, CATEGORIES, type Category } from './categories.js';

export interface ParsedExpense {
  amount: number; // in baht (not cents)
  category: Category;
  description: string;
}

/**
 * Parse expense message with multiple formats:
 * - "กาแฟ 85" → Coffee 85 THB
 * - "food 120" → Food 120 THB
 * - "อาหาร 120 ข้าวมันไก่" → Food 120 THB "ข้าวมันไก่"
 * - "85 กาแฟ" → Other 85 THB "กาแฟ"
 * - "120 ข้าวมันไก่" → Other 120 THB "ข้าวมันไก่"
 */
export function parseExpense(text: string): ParsedExpense | null {
  const trimmed = text.trim();
  
  // Find the first number (amount)
  const amountMatch = trimmed.match(/[\d,]+(?:\.\d{1,2})?/);
  
  if (!amountMatch) {
    return null; // No amount found
  }
  
  const amountStr = amountMatch[0].replace(/,/g, '');
  const amount = parseFloat(amountStr);
  
  if (isNaN(amount) || amount <= 0) {
    return null;
  }
  
  // Split text into words
  const words = trimmed.split(/\s+/);
  
  let category: Category = CATEGORIES.OTHER;
  const descriptionParts: string[] = [];
  
  for (const word of words) {
    // Skip the amount itself
    if (word.replace(/,/g, '') === amountStr) {
      continue;
    }
    
    // Try to find category
    const foundCategory = findCategory(word);
    if (foundCategory && category === CATEGORIES.OTHER) {
      category = foundCategory;
    } else {
      // Not a category, add to description
      descriptionParts.push(word);
    }
  }
  
  const description = descriptionParts.join(' ').trim();
  
  return {
    amount,
    category,
    description,
  };
}
