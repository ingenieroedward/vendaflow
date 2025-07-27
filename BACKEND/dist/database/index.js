"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeDatabase = exports.initializeDatabase = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const config_1 = require("../config");
// Import models here
const user_model_1 = require("../modules/user/user.model");
const category_model_1 = require("../modules/category/category.model");
const product_model_1 = require("../modules/product/product.model");
const supplier_model_1 = require("../modules/supplier/supplier.model");
const price_model_1 = require("../modules/price/price.model");
const customer_model_1 = require("../modules/customer/customer.model");
const order_model_1 = require("../modules/order/order.model");
const order_item_model_1 = require("../modules/order/order-item.model");
const sequelize = new sequelize_typescript_1.Sequelize({
    dialect: config_1.config.database.dialect,
    host: config_1.config.database.host,
    port: config_1.config.database.port,
    database: config_1.config.database.name,
    username: config_1.config.database.user,
    password: config_1.config.database.password,
    logging: config_1.config.server.nodeEnv === 'development' ? console.log : false,
    models: [user_model_1.User, category_model_1.Category, product_model_1.Product, supplier_model_1.Supplier, price_model_1.Price, customer_model_1.Customer, order_model_1.Order, order_item_model_1.OrderItem], // Add all models here
    modelMatch: (filename, member) => {
        return filename.substring(0, filename.indexOf('.model')) === member.toLowerCase();
    },
});
const initializeDatabase = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connection established successfully.');
        // Sync database in development
        if (config_1.config.server.nodeEnv === 'development') {
            await sequelize.sync();
            console.log('✅ Database synchronized.');
            await createDefaultCategory();
        }
    }
    catch (error) {
        console.error('❌ Unable to connect to the database:', error);
        process.exit(1);
    }
};
exports.initializeDatabase = initializeDatabase;
const createDefaultCategory = async () => {
    try {
        const defaultCategory = await category_model_1.Category.findOrCreate({
            where: { name: 'Sin categoría' },
            defaults: { name: 'Sin categoría' }
        });
        if (defaultCategory[1]) {
            console.log('✅ Default category "Sin categoría" created.');
        }
    }
    catch (error) {
        console.error('❌ Error creating default category:', error);
    }
};
const closeDatabase = async () => {
    try {
        await sequelize.close();
        console.log('✅ Database connection closed.');
    }
    catch (error) {
        console.error('❌ Error closing database connection:', error);
    }
};
exports.closeDatabase = closeDatabase;
exports.default = sequelize;
//# sourceMappingURL=index.js.map