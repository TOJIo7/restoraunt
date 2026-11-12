// Допустимые значения строковых полей в базе (SQLite не умеет enum).

export const ROLES = ["OWNER", "CASHIER"] as const;
export type Role = (typeof ROLES)[number];

export const POSITIONS = ["WAITER", "COOK", "CASHIER", "COURIER", "CLEANER", "MANAGER"] as const;
export type Position = (typeof POSITIONS)[number];

export const PAY_TYPES = ["MONTHLY", "PER_SHIFT", "HOURLY"] as const;
export type PayType = (typeof PAY_TYPES)[number];

export const UNITS = ["KG", "L", "PCS"] as const;
export type Unit = (typeof UNITS)[number];

export const ORDER_TYPES = ["DINE_IN", "TAKEAWAY", "DELIVERY"] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const ORDER_STATUSES = ["OPEN", "BILL", "PAID", "CANCELLED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_METHODS = ["CASH", "CARD", "TRANSFER", "QR"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const TABLE_STATUSES = ["FREE", "BUSY", "RESERVED", "BILL"] as const;
export type TableStatus = (typeof TABLE_STATUSES)[number];

export const TABLE_SHAPES = ["square", "round", "long"] as const;
export type TableShape = (typeof TABLE_SHAPES)[number];

/** Сетка схемы зала (в клетках). */
export const HALL_COLS = 8;
export const HALL_ROWS = 5;

/** Ширина стола в клетках сетки. */
export function tableSpan(shape: string) {
  return shape === "long" ? 2 : 1;
}

/** Время бездействия, после которого кассир выходит автоматически. */
export const CASHIER_IDLE_MS = 15 * 60 * 1000;
/** Время жизни сессии владельца без активности. */
export const OWNER_IDLE_MS = 8 * 60 * 60 * 1000;
