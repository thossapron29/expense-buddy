// Category definitions with bilingual aliases

export const CATEGORIES = {
  FOOD: 'FOOD',
  TRANSPORT: 'TRANSPORT',
  SHOPPING: 'SHOPPING',
  BILLS: 'BILLS',
  HEALTH: 'HEALTH',
  COFFEE: 'COFFEE',
  ENTERTAINMENT: 'ENTERTAINMENT',
  OTHER: 'OTHER',
} as const;

export type Category = typeof CATEGORIES[keyof typeof CATEGORIES];

// Category aliases (Thai + English)
const CATEGORY_ALIASES: Record<string, Category> = {
  // Food / อาหาร
  'อาหาร': CATEGORIES.FOOD,
  'ข้าว': CATEGORIES.FOOD,
  'ของกิน': CATEGORIES.FOOD,
  'food': CATEGORIES.FOOD,
  'meal': CATEGORIES.FOOD,
  
  // Transport / เดินทาง
  'เดินทาง': CATEGORIES.TRANSPORT,
  'รถ': CATEGORIES.TRANSPORT,
  'รถไฟฟ้า': CATEGORIES.TRANSPORT,
  'bts': CATEGORIES.TRANSPORT,
  'mrt': CATEGORIES.TRANSPORT,
  'taxi': CATEGORIES.TRANSPORT,
  'grab': CATEGORIES.TRANSPORT,
  'transport': CATEGORIES.TRANSPORT,
  
  // Shopping / ช้อปปิ้ง
  'ช้อป': CATEGORIES.SHOPPING,
  'ช้อปปิ้ง': CATEGORIES.SHOPPING,
  'shopping': CATEGORIES.SHOPPING,
  'shop': CATEGORIES.SHOPPING,
  'ของ': CATEGORIES.SHOPPING,
  '7-11': CATEGORIES.SHOPPING,
  'เซเว่น': CATEGORIES.SHOPPING,
  
  // Bills / บิล
  'บิล': CATEGORIES.BILLS,
  'ค่าไฟ': CATEGORIES.BILLS,
  'ค่าน้ำ': CATEGORIES.BILLS,
  'เน็ต': CATEGORIES.BILLS,
  'โทร': CATEGORIES.BILLS,
  'bill': CATEGORIES.BILLS,
  'utility': CATEGORIES.BILLS,
  
  // Health / สุขภาพ
  'สุขภาพ': CATEGORIES.HEALTH,
  'ยา': CATEGORIES.HEALTH,
  'หมอ': CATEGORIES.HEALTH,
  'คลินิก': CATEGORIES.HEALTH,
  'health': CATEGORIES.HEALTH,
  'clinic': CATEGORIES.HEALTH,
  
  // Coffee / คาเฟ่
  'กาแฟ': CATEGORIES.COFFEE,
  'coffee': CATEGORIES.COFFEE,
  'cafe': CATEGORIES.COFFEE,
  'ชา': CATEGORIES.COFFEE,
  'tea': CATEGORIES.COFFEE,
  
  // Entertainment / บันเทิง
  'หนัง': CATEGORIES.ENTERTAINMENT,
  'เกม': CATEGORIES.ENTERTAINMENT,
  'netflix': CATEGORIES.ENTERTAINMENT,
  'spotify': CATEGORIES.ENTERTAINMENT,
  'ent': CATEGORIES.ENTERTAINMENT,
  'entertainment': CATEGORIES.ENTERTAINMENT,
  'บันเทิง': CATEGORIES.ENTERTAINMENT,
  
  // Other / อื่นๆ
  'อื่นๆ': CATEGORIES.OTHER,
  'other': CATEGORIES.OTHER,
};

export function findCategory(word: string): Category | null {
  const normalized = word.toLowerCase().trim();
  return CATEGORY_ALIASES[normalized] || null;
}

export function getCategoryDisplay(category: Category): { th: string; en: string } {
  const display = {
    [CATEGORIES.FOOD]: { th: 'อาหาร', en: 'Food' },
    [CATEGORIES.TRANSPORT]: { th: 'เดินทาง', en: 'Transport' },
    [CATEGORIES.SHOPPING]: { th: 'ช้อปปิ้ง', en: 'Shopping' },
    [CATEGORIES.BILLS]: { th: 'บิล', en: 'Bills' },
    [CATEGORIES.HEALTH]: { th: 'สุขภาพ', en: 'Health' },
    [CATEGORIES.COFFEE]: { th: 'กาแฟ', en: 'Coffee' },
    [CATEGORIES.ENTERTAINMENT]: { th: 'บันเทิง', en: 'Entertainment' },
    [CATEGORIES.OTHER]: { th: 'อื่นๆ', en: 'Other' },
  };
  
  return display[category];
}
