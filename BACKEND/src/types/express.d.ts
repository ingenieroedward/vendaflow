declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        role: 'buyer' | 'seller' | 'admin' | 'superadmin';
        tenantId: number;
      };
    }
  }
}

export {};
