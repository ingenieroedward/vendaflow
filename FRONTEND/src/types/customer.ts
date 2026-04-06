export interface Customer {
  id: number;
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
  name: string;
  nit: string;
  contact?: string;
  address?: string;
  note?: string;
}

export interface UpdateCustomerRequest {
  name?: string;
  nit?: string;
  contact?: string;
  address?: string;
  note?: string;
}
