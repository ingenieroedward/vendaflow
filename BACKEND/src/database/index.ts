import { Sequelize } from 'sequelize-typescript';
import { config } from '@/config';

// Import models here
import { TenantRequest } from '@/modules/tenant/tenant-request.model';
import { PlanPayment } from '@/modules/tenant/plan-payment.model';
import { PlatformSetting } from '@/modules/tenant/platform-setting.model';
import { MetricDaily } from '@/modules/tenant/metric-daily.model';
import { PlatformAuditLog } from '@/modules/tenant/audit-log.model';
import { OrderPayment } from '@/modules/order/order-payment.model';
import { CashSession } from '@/modules/pos/cash-session.model';
import { PosSalePayment } from '@/modules/pos/pos-sale-payment.model';
import { Tenant } from '@/modules/tenant/tenant.model';
import { User } from '@/modules/user/user.model';
import { Category } from '@/modules/category/category.model';
import { Product } from '@/modules/product/product.model';
import { Supplier } from '@/modules/supplier/supplier.model';
import { Price } from '@/modules/price/price.model';
import { Customer } from '@/modules/customer/customer.model';
import { Order } from '@/modules/order/order.model';
import { OrderItem } from '@/modules/order/order-item.model';
import { Quote } from '@/modules/quote/quote.model';
import { QuoteItem } from '@/modules/quote/quote-item.model';
import { PushSubscription } from '@/modules/push/push-subscription.model';
import { PurchaseOrder } from '@/modules/purchase-order/purchase-order.model';
import { PurchaseOrderItem } from '@/modules/purchase-order/purchase-order-item/purchase-order-item.model';
import { StockMovement } from '@/modules/stock-movement/stock-movement.model';


const sequelize = new Sequelize({
  dialect: config.database.dialect,
  // MySQL devuelve DECIMAL como string; sin esto, sumas con esos campos concatenan texto
  dialectOptions: { decimalNumbers: true },
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  username: config.database.user,
  password: config.database.password,
  logging: config.server.nodeEnv === 'development' ? console.log : false,
  models: [Tenant, TenantRequest, PlanPayment, PlatformSetting, MetricDaily, PlatformAuditLog, OrderPayment, User, Category, Product, Supplier, Price, Customer, Order, OrderItem, Quote, QuoteItem, PushSubscription, PurchaseOrder, PurchaseOrderItem, StockMovement, CashSession, PosSalePayment],
  modelMatch: (filename, member) => {
    return filename.substring(0, filename.indexOf('.model')) === member.toLowerCase();
  },
});

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const initializeDatabase = async (): Promise<void> => {
  const maxRetries = 10;
  const retryDelay = 5000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await sequelize.authenticate();
      console.log('✅ Database connection established successfully.');

      // Sync database - crea tablas si no existen (safe para producción)
      await sequelize.sync({ alter: false });
      console.log('✅ Database synchronized.');
      return;
    } catch (error) {
      console.error(`❌ DB connection attempt ${attempt}/${maxRetries} failed:`, error);
      if (attempt === maxRetries) {
        console.error('❌ Unable to connect to the database after all retries.');
        throw error;
      }
      console.log(`⏳ Retrying in ${retryDelay / 1000}s...`);
      await wait(retryDelay);
    }
  }
};

// Default categories are now created per-tenant during onboarding (TenantService.create)

export const closeDatabase = async (): Promise<void> => {
  try {
    await sequelize.close();
    console.log('✅ Database connection closed.');
  } catch (error) {
    console.error('❌ Error closing database connection:', error);
  }
};

export default sequelize; 