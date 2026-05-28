export interface Customer {
  id: number;
  code?: string | null;
  name: string;
  nit?: string | null;
  contact?: string;
  address?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface CreateCustomerRequest {
  code?: string | null;
  name: string;
  nit: string;
  contact?: string;
  address?: string;
  note?: string;
}

export interface UpdateCustomerRequest {
  code?: string | null;
  name?: string;
  nit?: string;
  contact?: string;
  address?: string;
  note?: string;
}
