import { z } from 'zod';

// Quote Item DTO
export const quoteItemSchema = z.object({
  productId: z.coerce.number().positive('Product ID must be positive'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  taxRate: z.coerce.number().min(0, 'Tax rate must be non-negative'),
  unitPrice: z.coerce.number().min(0, 'Unit price must be non-negative'),
});

export type QuoteItemDto = z.infer<typeof quoteItemSchema>;

// Create Quote DTO
export const createQuoteSchema = z.object({
  clientRef: z.string().max(64).optional(),
  customerId: z.number().positive('Customer ID must be positive'),
  quoteNumber: z.string().max(50, 'Quote number too long').optional(),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted']).default('draft'),
  notes: z.string().optional(),
  validUntil: z.coerce.date().optional(),
  items: z.array(quoteItemSchema).min(1, 'At least one item is required'),
});

export type CreateQuoteDto = z.infer<typeof createQuoteSchema>;

// Update Quote DTO
export const updateQuoteSchema = z.object({
  customerId: z.number().positive('Customer ID must be positive').optional(),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted']).optional(),
  notes: z.string().optional(),
  validUntil: z.coerce.date().optional(),
  items: z.array(quoteItemSchema.partial().extend({ id: z.number().optional() })).optional(),
});

export type UpdateQuoteDto = z.infer<typeof updateQuoteSchema>;

// Search Quote DTO
export const searchQuoteSchema = z.object({
  q: z.string().min(1, 'Search query is required'),
});

export type SearchQuoteDto = z.infer<typeof searchQuoteSchema>;

// Quote Item Response DTO
export interface QuoteItemResponseDto {
  id: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  totalPrice: number;
  product?: {
    id: number;
    name: string;
    code: string;
    unit: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Quote Response DTO
export interface QuoteResponseDto {
  id: number;
  quoteNumber: string;
  customerId: number;
  userId: number;
  totalAmount: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';
  notes: string | null;
  validUntil: Date | null;
  convertedOrderId: number | null;
  customer?: {
    id: number;
    name: string;
    nit: string | null;
    contact: string | null;
    address: string | null;
  };
  user?: {
    id: number;
    username: string;
    role: string;
  };
  items?: QuoteItemResponseDto[];
  createdAt: Date;
  updatedAt: Date;
}

// Quotes List Response DTO
export interface QuotesListResponseDto {
  quotes: QuoteResponseDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
