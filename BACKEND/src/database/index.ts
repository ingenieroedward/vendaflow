import { Sequelize } from 'sequelize-typescript';
import { config } from '@/config';

// Import models here
import { User } from '@/modules/user/user.model';
import { Category } from '@/modules/category/category.model';
import { Product } from '@/modules/product/product.model';
import { Supplier } from '@/modules/supplier/supplier.model';
import { Price } from '@/modules/price/price.model';
import { Customer } from '@/modules/customer/customer.model';
import { Order } from '@/modules/order/order.model';
import { OrderItem } from '@/modules/order/order-item.model';
import { PushSubscription } from '@/modules/push/push-subscription.model';


const sequelize = new Sequelize({
  dialect: config.database.dialect,
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  username: config.database.user,
  password: config.database.password,
  logging: config.server.nodeEnv === 'development' ? console.log : false,
  models: [User, Category, Product, Supplier, Price, Customer, Order, OrderItem, PushSubscription], // Add all models here
  modelMatch: (filename, member) => {
    return filename.substring(0, filename.indexOf('.model')) === member.toLowerCase();
  },
});

export const initializeDatabase = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');

    // Sync database - crea tablas si no existen (safe para producción)
    await sequelize.sync({ alter: false });
    console.log('✅ Database synchronized.');
    await createDefaultCategory();
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    process.exit(1);
  }
};

const createDefaultCategory = async (): Promise<void> => {
  try {
    const defaultCategory = await Category.findOrCreate({
      where: { name: 'Sin categoría' },
      defaults: { name: 'Sin categoría' }
    });
    
    if (defaultCategory[1]) {
      console.log('✅ Default category "Sin categoría" created.');
    }
  } catch (error) {
    console.error('❌ Error creating default category:', error);
  }
};

export const closeDatabase = async (): Promise<void> => {
  try {
    await sequelize.close();
    console.log('✅ Database connection closed.');
  } catch (error) {
    console.error('❌ Error closing database connection:', error);
  }
};

export default sequelize; 