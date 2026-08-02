import { Customer, CustomerAttributes } from './customer.model';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  CustomerResponseDto,
  CustomersListResponseDto,
  SearchCustomerDto
} from './customer.dto';
import { NotFoundError } from '@/core/errors/AppError';
import { validateSchema, validatePartialSchema, paginationSchema, PaginationQuery } from '@/core/utils/validation';
import { createCustomerSchema, updateCustomerSchema, searchCustomerSchema } from './customer.dto';
import { Op, fn, col } from 'sequelize';
import { Order } from '@/modules/order/order.model';

export class CustomerService {
  async createCustomer(customerData: CreateCustomerDto, tenantId: number): Promise<CustomerResponseDto> {
    const validatedData = validateSchema(createCustomerSchema, customerData);
    const customer = await Customer.create({ ...validatedData, tenantId } as CustomerAttributes);
    return this.mapToResponseDto(customer);
  }

  async getAllCustomers(query: PaginationQuery, tenantId: number): Promise<CustomersListResponseDto> {
    const { page, limit } = validateSchema(paginationSchema, query);
    const validatedPage = page || 1;
    const validatedLimit = limit || 10;
    const offset = (validatedPage - 1) * validatedLimit;

    const { count, rows } = await Customer.findAndCountAll({
      where: { tenantId },
      limit: validatedLimit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    // Saldo pendiente (cartera) por cliente: total a crédito sin pagar MENOS
    // abonos registrados (antes ignoraba order_payments y mostraba de más)
    const creditOrders = rows.length
      ? await Order.findAll({
          where: {
            tenantId,
            customerId: rows.map(r => r.id),
            paymentType: 'credit',
            paidAt: null,
            status: { [Op.ne]: 'cancelled' },
          },
          attributes: ['id', 'customerId', 'totalAmount'],
          raw: true,
        }) as unknown as Array<{ id: number; customerId: number; totalAmount: string }>
      : [];
    const { OrderPayment } = await import('../order/order-payment.model');
    const paidRows = creditOrders.length
      ? await OrderPayment.findAll({
          where: { orderId: creditOrders.map(o => o.id) },
          attributes: ['orderId', [fn('SUM', col('amount')), 'paid']],
          group: ['orderId'],
          raw: true,
        }) as unknown as Array<{ orderId: number; paid: string }>
      : [];
    const paidMap = new Map(paidRows.map(pr => [pr.orderId, Number(pr.paid)]));
    const balanceMap = new Map<number, number>();
    for (const o of creditOrders) {
      const balance = Math.max(0, Number(o.totalAmount) - (paidMap.get(o.id) ?? 0));
      balanceMap.set(o.customerId, (balanceMap.get(o.customerId) ?? 0) + balance);
    }

    const customers = rows.map(customer => ({
      ...this.mapToResponseDto(customer),
      creditBalance: balanceMap.get(customer.id) ?? 0,
    }));
    const totalPages = Math.ceil(Number(count) / validatedLimit);

    return {
      customers,
      pagination: {
        page: validatedPage,
        limit: validatedLimit,
        total: Number(count),
        totalPages,
      },
    };
  }

  async getCustomerById(id: number, tenantId: number): Promise<CustomerResponseDto> {
    const customer = await Customer.findOne({ where: { id, tenantId } });
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }
    return this.mapToResponseDto(customer);
  }

  async updateCustomer(id: number, updateData: UpdateCustomerDto, tenantId: number): Promise<CustomerResponseDto> {
    const validatedData = validatePartialSchema(updateCustomerSchema, updateData) as Partial<UpdateCustomerDto>;

    const customer = await Customer.findOne({ where: { id, tenantId } });
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    await customer.update(validatedData as any);
    return this.mapToResponseDto(customer);
  }

  async deleteCustomer(id: number, tenantId: number): Promise<void> {
    const customer = await Customer.findOne({ where: { id, tenantId } });
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    if (customer.code) {
      await customer.update({ code: null });
    }

    await customer.destroy();
  }

  async getDeletedCustomers(tenantId: number): Promise<CustomerResponseDto[]> {
    const customers = await Customer.findAll({
      where: { tenantId, deletedAt: { [Op.ne]: null } } as any,
      paranoid: false,
      order: [['deletedAt', 'DESC']],
    });
    return customers.map(c => this.mapToResponseDto(c));
  }

  async restoreCustomer(id: number, tenantId: number): Promise<CustomerResponseDto> {
    const customer = await Customer.findOne({
      where: { id, tenantId, deletedAt: { [Op.ne]: null } } as any,
      paranoid: false,
    });
    if (!customer) throw new NotFoundError('Customer not found in trash');
    await customer.restore();
    return this.mapToResponseDto(customer);
  }

  async hardDeleteCustomer(id: number, tenantId: number): Promise<void> {
    const customer = await Customer.findOne({
      where: { id, tenantId, deletedAt: { [Op.ne]: null } } as any,
      paranoid: false,
    });
    if (!customer) throw new NotFoundError('Customer not found in trash');
    await customer.destroy({ force: true });
  }

  async searchCustomers(searchData: SearchCustomerDto, tenantId: number): Promise<CustomerResponseDto[]> {
    const validatedData = validateSchema(searchCustomerSchema, searchData) as SearchCustomerDto;

    const customers = await Customer.findAll({
      where: {
        tenantId,
        [Op.or]: [
          { code: { [Op.like]: `%${validatedData.q}%` } },
          { name: { [Op.like]: `%${validatedData.q}%` } },
          { nit: { [Op.like]: `%${validatedData.q}%` } },
          { contact: { [Op.like]: `%${validatedData.q}%` } },
          { address: { [Op.like]: `%${validatedData.q}%` } },
        ],
      },
      order: [['name', 'ASC']],
    });

    return customers.map(customer => this.mapToResponseDto(customer));
  }

  private mapToResponseDto(customer: Customer): CustomerResponseDto {
    return {
      id: customer.id,
      code: customer.code ?? null,
      name: customer.name,
      nit: customer.nit,
      contact: customer.contact,
      address: customer.address,
      note: customer.note,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  }
}
