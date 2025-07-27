"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Supplier = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const price_model_1 = require("../price/price.model");
let Supplier = class Supplier extends sequelize_typescript_1.Model {
    // JSON serialization
    toJSON() {
        const values = { ...this.get() };
        return values;
    }
};
exports.Supplier = Supplier;
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    }),
    __metadata("design:type", Number)
], Supplier.prototype, "id", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING(255),
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [1, 255],
        },
    }),
    __metadata("design:type", String)
], Supplier.prototype, "name", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING(255),
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [1, 255],
        },
    }),
    __metadata("design:type", String)
], Supplier.prototype, "contact", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING(255),
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [1, 255],
        },
    }),
    __metadata("design:type", String)
], Supplier.prototype, "location", void 0);
__decorate([
    sequelize_typescript_1.CreatedAt,
    __metadata("design:type", Date)
], Supplier.prototype, "createdAt", void 0);
__decorate([
    sequelize_typescript_1.UpdatedAt,
    __metadata("design:type", Date)
], Supplier.prototype, "updatedAt", void 0);
__decorate([
    sequelize_typescript_1.DeletedAt,
    __metadata("design:type", Date)
], Supplier.prototype, "deletedAt", void 0);
__decorate([
    (0, sequelize_typescript_1.HasMany)(() => price_model_1.Price),
    __metadata("design:type", Array)
], Supplier.prototype, "prices", void 0);
exports.Supplier = Supplier = __decorate([
    (0, sequelize_typescript_1.Table)({
        tableName: 'suppliers',
        timestamps: true,
        paranoid: true, // Soft deletes
    })
], Supplier);
//# sourceMappingURL=supplier.model.js.map