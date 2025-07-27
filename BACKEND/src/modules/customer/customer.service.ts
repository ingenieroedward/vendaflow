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
import { Op } from 'sequelize';

export class CustomerService {
  async createCustomer(customerData: CreateCustomerDto): Promise<CustomerResponseDto> {
    const validatedData = validateSchema(createCustomerSchema, customerData);
    const customer = await Customer.create(validatedData as CustomerAttributes);
    return this.mapToResponseDto(customer);
  }

  async getAllCustomers(query: PaginationQuery): Promise<CustomersListResponseDto> {
    const { page, limit } = validateSchema(paginationSchema, query);
    const validatedPage = page || 1;
    const validatedLimit = limit || 10;
    const offset = (validatedPage - 1) * validatedLimit;

    const { count, rows } = await Customer.findAndCountAll({
      limit: validatedLimit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    const customers = rows.map(customer => this.mapToResponseDto(customer));
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

  async getCustomerById(id: number): Promise<CustomerResponseDto> {
    const customer = await Customer.findByPk(id);

    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    return this.mapToResponseDto(customer);
  }

  async updateCustomer(id: number, updateData: UpdateCustomerDto): Promise<CustomerResponseDto> {
    const validatedData = validatePartialSchema(updateCustomerSchema, updateData) as Partial<UpdateCustomerDto>;

    const customer = await Customer.findByPk(id);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    await customer.update(validatedData as any);
    return this.mapToResponseDto(customer);
  }

  async deleteCustomer(id: number): Promise<void> {
    const customer = await Customer.findByPk(id);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    await customer.destroy();
  }

  async searchCustomers(searchData: SearchCustomerDto): Promise<CustomerResponseDto[]> {
    const validatedData = validateSchema(searchCustomerSchema, searchData) as SearchCustomerDto;

    const customers = await Customer.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.like]: `%${validatedData.q}%` } },
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
      name: customer.name,
      contact: customer.contact,
      address: customer.address,
      note: customer.note,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  }
} 