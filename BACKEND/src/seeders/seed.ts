import 'reflect-metadata';
import dotenv from 'dotenv';
dotenv.config();

import { Sequelize } from 'sequelize-typescript';
import bcrypt from 'bcryptjs';
import { config } from '@/config';

// Models
import { User } from '@/modules/user/user.model';
import { Category } from '@/modules/category/category.model';
import { Product } from '@/modules/product/product.model';
import { Supplier } from '@/modules/supplier/supplier.model';
import { Price } from '@/modules/price/price.model';
import { Customer } from '@/modules/customer/customer.model';
import { Order } from '@/modules/order/order.model';
import { OrderItem } from '@/modules/order/order-item.model';
import { PushSubscription } from '@/modules/push/push-subscription.model';

// ──────────────────────────────────────────────────────────────
// Database connection
// ──────────────────────────────────────────────────────────────
const sequelize = new Sequelize({
  dialect: 'mysql',
  host: process.env['DB_HOST'] || config.database.host,
  port: Number(process.env['DB_PORT'] ?? config.database.port),
  database: process.env['DB_NAME'] || config.database.name,
  username: process.env['DB_USER'] || config.database.user,
  password: process.env['DB_PASSWORD'] || config.database.password,
  logging: false,
  models: [User, Category, Product, Supplier, Price, Customer, Order, OrderItem, PushSubscription],
});

// ──────────────────────────────────────────────────────────────
// Seed data definitions
// ──────────────────────────────────────────────────────────────

const USERS = [
  { username: 'admin',  password: 'admin123',  role: 'admin'  as const },
  { username: 'seller', password: 'seller123', role: 'seller' as const },
  { username: 'buyer',  password: 'buyer123',  role: 'buyer'  as const },
];

const CATEGORY_NAMES = [
  'Herramientas',
  'Materiales Eléctricos',
  'Plomería',
  'Ferretería General',
  'Pinturas y Acabados',
  'Seguridad Industrial',
  'Tornillería',
  'Adhesivos y Sellantes',
];

const SUPPLIERS = [
  { name: 'Distribuidora FERREX S.A.',          contact: '601-345-7890', location: 'Bogotá, Cundinamarca'    },
  { name: 'IMPOHERRAMIENTA del Norte Ltda.',     contact: '574-892-1234', location: 'Medellín, Antioquia'     },
  { name: 'Suministros Industriales PROTEK',     contact: '572-456-8901', location: 'Cali, Valle del Cauca'   },
  { name: 'Comercializadora METALSA S.A.S.',     contact: '575-321-6540', location: 'Barranquilla, Atlántico' },
  { name: 'Ferretería y Construcción CONSUTEK',  contact: '607-654-3210', location: 'Bucaramanga, Santander'  },
];

// Products grouped by category index (0-based, matching CATEGORY_NAMES)
// Format: [name, code, unit, salePrice]
type ProductRow = [string, string, string, number];

const PRODUCTS_BY_CATEGORY: ProductRow[][] = [
  // 0 - Herramientas (50 products)
  [
    ['Martillo de Carpintero 16 oz',              'HRMT01', 'und',  28500],
    ['Martillo de Bola 12 oz',                    'HRMT02', 'und',  24000],
    ['Destornillador Plano 1/4"',                 'HRMT03', 'und',   6500],
    ['Destornillador Estrella #2',                'HRMT04', 'und',   7200],
    ['Juego de Destornilladores x6',              'HRMT05', 'set',  32000],
    ['Alicate de Corte 6"',                       'HRMT06', 'und',  18500],
    ['Alicate Universal 8"',                      'HRMT07', 'und',  21000],
    ['Alicate de Presión 7"',                     'HRMT08', 'und',  26000],
    ['Llave Ajustable 10"',                       'HRMT09', 'und',  22000],
    ['Llave Ajustable 12"',                       'HRMT10', 'und',  28000],
    ['Juego de Llaves Fijas x12',                 'HRMT11', 'set',  65000],
    ['Juego de Llaves Hexagonales x9',            'HRMT12', 'set',  18000],
    ['Nivel de Burbuja 24"',                      'HRMT13', 'und',  32000],
    ['Nivel de Burbuja 48"',                      'HRMT14', 'und',  52000],
    ['Cinta Métrica 5 m',                         'HRMT15', 'und',  12000],
    ['Cinta Métrica 8 m',                         'HRMT16', 'und',  16500],
    ['Sierra Caladora Manual',                    'HRMT17', 'und',  48000],
    ['Sierra Arco para Metales',                  'HRMT18', 'und',  25000],
    ['Taladro Percutor 600W',                     'HRMT19', 'und', 185000],
    ['Taladro Inalámbrico 18V',                   'HRMT20', 'und', 320000],
    ['Esmeril Angular 4.5"',                      'HRMT21', 'und', 145000],
    ['Esmeril Angular 7"',                        'HRMT22', 'und', 230000],
    ['Plomada de Hilo',                           'HRMT23', 'und',   8500],
    ['Escuadra Combinada 12"',                    'HRMT24', 'und',  28000],
    ['Serrucho para Madera 22"',                  'HRMT25', 'und',  35000],
    ['Formón 1" Mango Madera',                    'HRMT26', 'und',  14500],
    ['Juego de Formones x4',                      'HRMT27', 'set',  52000],
    ['Lima Plana 10"',                            'HRMT28', 'und',   9500],
    ['Lima Redonda 8"',                           'HRMT29', 'und',   8000],
    ['Juego de Limas x5',                         'HRMT30', 'set',  38000],
    ['Espátula Metálica 2"',                      'HRMT31', 'und',   5500],
    ['Espátula Metálica 4"',                      'HRMT32', 'und',   7800],
    ['Pistola de Calor 1800W',                    'HRMT33', 'und',  95000],
    ['Pistola de Silicona Eléctrica',             'HRMT34', 'und',  22000],
    ['Tenaza de Carpintero 10"',                  'HRMT35', 'und',  15000],
    ['Cortafríos 1/2" x 6"',                      'HRMT36', 'und',   7200],
    ['Punzón de Centrar',                         'HRMT37', 'und',   4500],
    ['Pie de Rey Vernier 6"',                     'HRMT38', 'und',  48000],
    ['Calibrador Digital 6"',                     'HRMT39', 'und',  75000],
    ['Cepillo de Carpintero N.5',                 'HRMT40', 'und',  45000],
    ['Compresor de Aire 24L 2HP',                 'HRMT41', 'und', 420000],
    ['Pistola para Pintura HVLP',                 'HRMT42', 'und',  85000],
    ['Llave de Boca Estrella 13mm',               'HRMT43', 'und',   8500],
    ['Llave de Boca Estrella 17mm',               'HRMT44', 'und',  10000],
    ['Cincel para Concreto 3/4"',                 'HRMT45', 'und',  12000],
    ['Macho de Roscar M8',                        'HRMT46', 'und',  18000],
    ['Terrajas para Tubo 1/2"',                   'HRMT47', 'und',  65000],
    ['Regla Metálica 30 cm',                      'HRMT48', 'und',   6500],
    ['Gramil de Carpintero',                      'HRMT49', 'und',  22000],
    ['Caja de Ingletes Manual',                   'HRMT50', 'und',  38000],
  ],

  // 1 - Materiales Eléctricos (50 products)
  [
    ['Cable THHN 12 AWG Negro x 100m',            'ELCT01', 'rollo', 185000],
    ['Cable THHN 12 AWG Blanco x 100m',           'ELCT02', 'rollo', 185000],
    ['Cable THHN 12 AWG Verde x 100m',            'ELCT03', 'rollo', 185000],
    ['Cable THHN 10 AWG Negro x 100m',            'ELCT04', 'rollo', 265000],
    ['Cable THHN 8 AWG Negro x 100m',             'ELCT05', 'rollo', 390000],
    ['Cable Duplex 2x12 AWG x 100m',              'ELCT06', 'rollo', 210000],
    ['Interruptor Sencillo 15A',                  'ELCT07', 'und',    8500],
    ['Interruptor Doble 15A',                     'ELCT08', 'und',   12000],
    ['Toma Corriente Sencilla 15A',               'ELCT09', 'und',    7500],
    ['Toma Corriente Doble 15A',                  'ELCT10', 'und',   10500],
    ['Caja Octogonal Galvanizada 4"',             'ELCT11', 'und',    3800],
    ['Caja Rectangular Galvanizada 2x4"',         'ELCT12', 'und',    3200],
    ['Canaleta PVC 20x10mm x 2m',                 'ELCT13', 'und',    8500],
    ['Canaleta PVC 40x25mm x 2m',                 'ELCT14', 'und',   14000],
    ['Tubo Conduit PVC 3/4" x 3m',               'ELCT15', 'und',    9500],
    ['Tubo Conduit PVC 1" x 3m',                 'ELCT16', 'und',   13500],
    ['Tubo EMT 3/4" x 3m',                       'ELCT17', 'und',   24000],
    ['Breaker 1P 15A',                            'ELCT18', 'und',   18500],
    ['Breaker 1P 20A',                            'ELCT19', 'und',   19000],
    ['Breaker 2P 30A',                            'ELCT20', 'und',   42000],
    ['Tablero 4 Circuitos con Barra',             'ELCT21', 'und',   65000],
    ['Tablero 8 Circuitos con Barra',             'ELCT22', 'und',   95000],
    ['Cinta Aislante 3/4" x 18m',                'ELCT23', 'und',    4500],
    ['Tape de Teflón 1/2" x 10m',                'ELCT24', 'und',    2500],
    ['Conector EMT Recto 3/4"',                   'ELCT25', 'und',    3200],
    ['Conector PVC Curvo 3/4"',                   'ELCT26', 'und',    2800],
    ['Foco LED 9W E27',                           'ELCT27', 'und',   12500],
    ['Foco LED 15W E27',                          'ELCT28', 'und',   16500],
    ['Foco LED Dicroico GU10 7W',                 'ELCT29', 'und',   14000],
    ['Bombillo Ahorrador 23W',                    'ELCT30', 'und',    9500],
    ['Roseta de Techo Sencilla',                  'ELCT31', 'und',    3500],
    ['Extensión Eléctrica 5m 3 Tomas',           'ELCT32', 'und',   22000],
    ['Multímetro Digital',                        'ELCT33', 'und',   65000],
    ['Comprobador de Voltaje',                    'ELCT34', 'und',   28000],
    ['Brida Plástica 3x100mm x100',              'ELCT35', 'paq',    5500],
    ['Brida Plástica 4x200mm x100',              'ELCT36', 'paq',    8500],
    ['Grapa para Cable 1/4"',                     'ELCT37', 'und',    1200],
    ['Caja PVC Exterior 2x4"',                   'ELCT38', 'und',    5800],
    ['Plafón para Lámpara 4"',                   'ELCT39', 'und',    8500],
    ['Timbre de Puerta 220V',                     'ELCT40', 'und',   28000],
    ['Interruptor de Movimiento',                 'ELCT41', 'und',   45000],
    ['Fotocelda 1000W',                           'ELCT42', 'und',   32000],
    ['Regleta de Conexión x12',                  'ELCT43', 'und',   18500],
    ['Terminal Pin Preaislado 1.5mm x100',        'ELCT44', 'paq',    9500],
    ['Terminal Ojo 1/4" x50',                    'ELCT45', 'paq',    8000],
    ['Tubo Termoencogible 3mm x 1m',             'ELCT46', 'und',    2500],
    ['Bornera de Riel DIN 4mm x10',              'ELCT47', 'und',   14000],
    ['Riel DIN 35mm x 1m',                       'ELCT48', 'und',   12000],
    ['Transformador 220V/110V 500VA',             'ELCT49', 'und',   85000],
    ['UPS 800VA',                                 'ELCT50', 'und',  245000],
  ],

  // 2 - Plomería (50 products)
  [
    ['Tubo PVC Presión 1/2" x 6m',               'PLOM01', 'und',   18500],
    ['Tubo PVC Presión 3/4" x 6m',               'PLOM02', 'und',   26000],
    ['Tubo PVC Presión 1" x 6m',                 'PLOM03', 'und',   38000],
    ['Tubo PVC Sanitario 2" x 3m',               'PLOM04', 'und',   22000],
    ['Tubo PVC Sanitario 3" x 3m',               'PLOM05', 'und',   38000],
    ['Tubo PVC Sanitario 4" x 3m',               'PLOM06', 'und',   52000],
    ['Codo PVC 1/2" x 90°',                      'PLOM07', 'und',    1800],
    ['Codo PVC 3/4" x 90°',                      'PLOM08', 'und',    2500],
    ['Codo PVC 1" x 90°',                        'PLOM09', 'und',    4200],
    ['Te PVC 1/2"',                               'PLOM10', 'und',    2200],
    ['Te PVC 3/4"',                               'PLOM11', 'und',    3200],
    ['Unión PVC 1/2"',                            'PLOM12', 'und',    1200],
    ['Unión PVC 3/4"',                            'PLOM13', 'und',    1800],
    ['Reducción PVC 1" a 3/4"',                  'PLOM14', 'und',    2800],
    ['Llave de Paso Bola 1/2"',                  'PLOM15', 'und',   12000],
    ['Llave de Paso Bola 3/4"',                  'PLOM16', 'und',   18500],
    ['Llave de Paso Bola 1"',                    'PLOM17', 'und',   28000],
    ['Grifo para Jardín 1/2"',                   'PLOM18', 'und',   15000],
    ['Válvula Check 3/4"',                       'PLOM19', 'und',   32000],
    ['Válvula de Flotador 1/2"',                 'PLOM20', 'und',   22000],
    ['Fluxómetro para WC 1/2"',                  'PLOM21', 'und',   95000],
    ['Asiento para WC Universal',                'PLOM22', 'und',   65000],
    ['Llave Mezcladora para Lavamanos',           'PLOM23', 'und',   85000],
    ['Llave Mezcladora para Ducha',              'PLOM24', 'und',  120000],
    ['Regadera de Ducha 8"',                     'PLOM25', 'und',   45000],
    ['Trampa para Lavaplatos 2"',                'PLOM26', 'und',   18500],
    ['Trampa para Lavamanos 1.1/4"',             'PLOM27', 'und',   14000],
    ['Sifón Botella para Lavamanos',             'PLOM28', 'und',   12000],
    ['Tubo Corrugado Flexible 1/2" x 30cm',      'PLOM29', 'und',    8500],
    ['Ángulo de Manguera 1/2" x 40cm',           'PLOM30', 'und',   12000],
    ['Empaque de Grifería 1/2" x10',             'PLOM31', 'paq',    3500],
    ['Pegante PVC 250ml',                         'PLOM32', 'und',   18500],
    ['Limpiador PVC 250ml',                       'PLOM33', 'und',   12000],
    ['Teflón 1/2" x 10m',                        'PLOM34', 'und',    2800],
    ['Tubo Cobre 1/2" x 3m',                     'PLOM35', 'und',   65000],
    ['Codo Cobre 1/2" x 90°',                    'PLOM36', 'und',    5500],
    ['Unión Universal PVC 1/2"',                 'PLOM37', 'und',    8500],
    ['Adaptador Macho PVC 1/2"',                 'PLOM38', 'und',    1500],
    ['Adaptador Hembra PVC 1/2"',                'PLOM39', 'und',    1500],
    ['Tapón PVC 1/2"',                           'PLOM40', 'und',    1200],
    ['Bomba de Agua Periférica 0.5HP',           'PLOM41', 'und',  285000],
    ['Bomba Sumergible 1HP',                     'PLOM42', 'und',  450000],
    ['Tanque Plástico 500L',                     'PLOM43', 'und',  320000],
    ['Tanque Plástico 1000L',                    'PLOM44', 'und',  580000],
    ['Filtro de Agua Sedimentos 10"',            'PLOM45', 'und',   85000],
    ['Cartucho de Filtro 10" 5 micrones',        'PLOM46', 'und',   18500],
    ['Medidor de Agua 1/2"',                     'PLOM47', 'und',   95000],
    ['Reductor de Presión 3/4"',                 'PLOM48', 'und',  125000],
    ['Calentador de Agua Eléctrico 30L',         'PLOM49', 'und',  850000],
    ['Ducha Eléctrica 6000W',                    'PLOM50', 'und',  145000],
  ],

  // 3 - Ferretería General (50 products)
  [
    ['Candado Cementado 40mm',                   'FRRG01', 'und',   18500],
    ['Candado Cementado 50mm',                   'FRRG02', 'und',   24000],
    ['Candado de Disco 50mm',                    'FRRG03', 'und',   35000],
    ['Cerradura de Sobreponer Doble Paleta',     'FRRG04', 'und',   42000],
    ['Cerradura de Embutir 3 Puntos',            'FRRG05', 'und',   95000],
    ['Bisagra de Puerta 3.5" x3',               'FRRG06', 'paq',   12000],
    ['Bisagra de Puerta 4" x3',                 'FRRG07', 'paq',   15000],
    ['Bisagra Invisible para Madera x2',         'FRRG08', 'paq',    8500],
    ['Manija para Puerta con Roseta',            'FRRG09', 'und',   32000],
    ['Pasador Metálico 3"',                      'FRRG10', 'und',    6500],
    ['Pasador Metálico 4"',                      'FRRG11', 'und',    8500],
    ['Gancho Doble para Pared',                  'FRRG12', 'und',    4500],
    ['Alcayata Galvanizada 2" x100',             'FRRG13', 'paq',    8500],
    ['Grapas para Cerca x1kg',                   'FRRG14', 'kg',    12000],
    ['Cadena Galvanizada 1/4" x 5m',             'FRRG15', 'und',   28000],
    ['Cadena Galvanizada 3/8" x 5m',             'FRRG16', 'und',   45000],
    ['Eslabón Rápido 1/4"',                      'FRRG17', 'und',    3500],
    ['Eslabón Rápido 3/8"',                      'FRRG18', 'und',    5500],
    ['Mosquetón 50mm',                           'FRRG19', 'und',    8500],
    ['Cable de Acero 1/4" x 5m',                'FRRG20', 'und',   32000],
    ['Tensor de Cable Galvanizado 1/4"',         'FRRG21', 'und',    5500],
    ['Tornillo Lag 5/16" x 3" x50',             'FRRG22', 'paq',   18500],
    ['Perno Galvanizado 3/8" x 2" x25',         'FRRG23', 'paq',   15000],
    ['Ancla Expansiva 3/8" x 2" x10',           'FRRG24', 'paq',   12000],
    ['Taco Fisher 6mm x100',                    'FRRG25', 'paq',    6500],
    ['Taco Fisher 8mm x50',                     'FRRG26', 'paq',    5500],
    ['Pintura de Aceite Amarillo 1/4 galon',     'FRRG27', 'und',   22000],
    ['Fibra de Lija Grano 80',                   'FRRG28', 'und',    3500],
    ['Fibra de Lija Grano 120',                  'FRRG29', 'und',    3500],
    ['Lija en Papel Grano 60 x Pliego',          'FRRG30', 'und',    2800],
    ['Lija en Papel Grano 100 x Pliego',         'FRRG31', 'und',    2800],
    ['Rodillo de Lana 9"',                       'FRRG32', 'und',   12000],
    ['Brocha de Nylon 2"',                       'FRRG33', 'und',    8500],
    ['Brocha de Nylon 4"',                       'FRRG34', 'und',   12000],
    ['Sellador de Silicona Blanco 280ml',        'FRRG35', 'und',   14000],
    ['Sellador de Silicona Transparente 280ml',  'FRRG36', 'und',   14000],
    ['Remache Pop 3/16" x 1" x100',             'FRRG37', 'paq',    8500],
    ['Remache Pop 1/8" x 1/2" x100',            'FRRG38', 'paq',    6500],
    ['Cinta Métrica 3m de Bolsillo',             'FRRG39', 'und',    8500],
    ['Tiza de Marcado Azul',                     'FRRG40', 'und',    3500],
    ['Lápiz de Carpintero x6',                  'FRRG41', 'paq',    5500],
    ['Guante de Carnaza Talla M',                'FRRG42', 'par',   22000],
    ['Guante de Carnaza Talla L',                'FRRG43', 'par',   22000],
    ['Guante de Nitrilo Talla M x100',          'FRRG44', 'paq',   45000],
    ['Tarro Plástico Sellado 5L',               'FRRG45', 'und',   12000],
    ['Tarro Metálico Galvanizado 4L',           'FRRG46', 'und',   18500],
    ['Cepillo de Acero Mango Madera',            'FRRG47', 'und',   12000],
    ['Cepillo de Acero Industrial',              'FRRG48', 'und',   18500],
    ['Hoja de Sierra para Metales 24T',          'FRRG49', 'und',    4500],
    ['Hoja de Sierra para Madera 18T',           'FRRG50', 'und',    4500],
  ],

  // 4 - Pinturas y Acabados (50 products)
  [
    ['Pintura Vinilo Interior Blanco x Galón',    'PINT01', 'galon',  42000],
    ['Pintura Vinilo Interior Marfil x Galón',    'PINT02', 'galon',  42000],
    ['Pintura Vinilo Interior Gris x Galón',      'PINT03', 'galon',  42000],
    ['Pintura Vinilo Exterior Blanco x Galón',    'PINT04', 'galon',  52000],
    ['Pintura Vinilo Exterior Terracota x Galón', 'PINT05', 'galon',  52000],
    ['Pintura Esmalte Blanco Brillante x Galón', 'PINT06', 'galon',  65000],
    ['Pintura Esmalte Negro Mate x Galón',        'PINT07', 'galon',  65000],
    ['Pintura Esmalte Amarillo x 1/4 Galón',      'PINT08', 'und',    18500],
    ['Pintura Anticorrosiva Gris x Galón',        'PINT09', 'galon',  72000],
    ['Pintura Anticorrosiva Rojo x Galón',        'PINT10', 'galon',  72000],
    ['Imprimante Vinilo Blanco x Galón',          'PINT11', 'galon',  28000],
    ['Imprimante Alquídico x Galón',              'PINT12', 'galon',  38000],
    ['Sellador de Superficies x Galón',           'PINT13', 'galon',  45000],
    ['Masilla Plástica x Galón',                  'PINT14', 'galon',  32000],
    ['Masilla Mural x 4kg',                       'PINT15', 'und',    22000],
    ['Thinner Acrílico x Galón',                  'PINT16', 'galon',  18500],
    ['Thinner Corriente x Galón',                 'PINT17', 'galon',  12000],
    ['Varsol x Galón',                            'PINT18', 'galon',  14000],
    ['Barniz para Madera x Galón',                'PINT19', 'galon',  55000],
    ['Barniz para Piso x Galón',                  'PINT20', 'galon',  68000],
    ['Laca Transparente x Galón',                 'PINT21', 'galon',  52000],
    ['Esmalte para Piso Gris x Galón',           'PINT22', 'galon',  78000],
    ['Esmalte para Piso Rojo x Galón',           'PINT23', 'galon',  78000],
    ['Pintura para Tráfico Blanco x Galón',       'PINT24', 'galon',  85000],
    ['Pintura para Tráfico Amarillo x Galón',     'PINT25', 'galon',  85000],
    ['Rodillo de Espuma 9"',                      'PINT26', 'und',    8500],
    ['Rodillo de Lana 7"',                        'PINT27', 'und',   10500],
    ['Bandeja para Rodillo 9"',                   'PINT28', 'und',    8500],
    ['Brocha Angular 2.5"',                       'PINT29', 'und',   12000],
    ['Brocha Plana 3"',                           'PINT30', 'und',   10000],
    ['Cinta de Enmascarar 2" x 50m',             'PINT31', 'und',    8500],
    ['Cinta de Enmascarar 1" x 50m',             'PINT32', 'und',    6500],
    ['Espátula para Masilla 3"',                  'PINT33', 'und',    7500],
    ['Espátula para Masilla 6"',                  'PINT34', 'und',   10500],
    ['Disco Lija para Pulidora 80G x5',           'PINT35', 'und',   15000],
    ['Disco Lija para Pulidora 120G x5',          'PINT36', 'und',   15000],
    ['Aerosol Pintura Blanco 400ml',              'PINT37', 'und',   12000],
    ['Aerosol Pintura Negro 400ml',               'PINT38', 'und',   12000],
    ['Aerosol Pintura Gris 400ml',                'PINT39', 'und',   12000],
    ['Aerosol Anticorrosivo Rojo 400ml',          'PINT40', 'und',   15000],
    ['Fijador de Superficies x Galón',            'PINT41', 'galon',  35000],
    ['Estuco Plástico x Saco 25kg',               'PINT42', 'saco',  38000],
    ['Mortero de Pega x Saco 25kg',               'PINT43', 'saco',  22000],
    ['Pintura Impermeabilizante x Galón',         'PINT44', 'galon',  95000],
    ['Membrana Asfáltica 4mm x 10m²',            'PINT45', 'und',  185000],
    ['Porcelana para Madera x Galón',             'PINT46', 'galon',  48000],
    ['Minio de Plomo x 1/4 Galón',               'PINT47', 'und',    28000],
    ['Pintura Texturizada Blanco x Galón',        'PINT48', 'galon',  52000],
    ['Pintura Efecto Marmol x Galón',             'PINT49', 'galon',  85000],
    ['Diluyente para Epóxico x Galón',            'PINT50', 'galon',  42000],
  ],

  // 5 - Seguridad Industrial (50 products)
  [
    ['Casco de Seguridad Clase B Blanco',         'SEGI01', 'und',   32000],
    ['Casco de Seguridad Clase B Amarillo',       'SEGI02', 'und',   32000],
    ['Casco de Seguridad con Rachet',             'SEGI03', 'und',   45000],
    ['Gafas de Seguridad Transparente',           'SEGI04', 'und',    8500],
    ['Gafas de Seguridad Oscura',                 'SEGI05', 'und',    8500],
    ['Gafas Panorámicas Antiempañante',           'SEGI06', 'und',   22000],
    ['Careta para Soldar #11',                    'SEGI07', 'und',   55000],
    ['Careta Facial Transparente',                'SEGI08', 'und',   28000],
    ['Protector Auditivo Copa',                   'SEGI09', 'und',   18500],
    ['Tapones para Oídos x2',                     'SEGI10', 'par',    3500],
    ['Respirador N95 x10',                        'SEGI11', 'paq',   35000],
    ['Respirador Media Cara 2 Vías',              'SEGI12', 'und',   65000],
    ['Cartucho para Vapores Orgánicos x2',        'SEGI13', 'par',   22000],
    ['Cartucho para Polvos x2',                   'SEGI14', 'par',   18500],
    ['Overol Tyvek Blanco Talla L',               'SEGI15', 'und',   28000],
    ['Overol Tyvek Blanco Talla XL',              'SEGI16', 'und',   28000],
    ['Chaleco Reflectivo Naranja Talla L',        'SEGI17', 'und',   22000],
    ['Chaleco Reflectivo Naranja Talla XL',       'SEGI18', 'und',   22000],
    ['Bota de Seguridad con Punta Talla 40',      'SEGI19', 'par',  145000],
    ['Bota de Seguridad con Punta Talla 42',      'SEGI20', 'par',  145000],
    ['Bota de Seguridad con Punta Talla 44',      'SEGI21', 'par',  145000],
    ['Guante de Punto Tricotado Algodón',         'SEGI22', 'par',    5500],
    ['Guante Hycron Talla 9',                     'SEGI23', 'par',   22000],
    ['Guante para Soldador',                      'SEGI24', 'par',   32000],
    ['Arnes de Seguridad 4 Puntos',               'SEGI25', 'und',  185000],
    ['Arnes de Cuerpo Completo',                  'SEGI26', 'und',  280000],
    ['Cuerda de Vida 2m',                         'SEGI27', 'und',   95000],
    ['Absorbedor de Choque 1.8m',                 'SEGI28', 'und',  145000],
    ['Línea de Vida Retráctil 3m',                'SEGI29', 'und',  285000],
    ['Extintor CO2 5lb',                          'SEGI30', 'und',   95000],
    ['Extintor ABC 10lb',                         'SEGI31', 'und',  125000],
    ['Señal Extintor Reflectiva',                 'SEGI32', 'und',    8500],
    ['Señal Salida de Emergencia',                'SEGI33', 'und',   12000],
    ['Señal Piso Húmedo',                         'SEGI34', 'und',   28000],
    ['Cono Reflectivo 71cm',                      'SEGI35', 'und',   22000],
    ['Cinta de Peligro Amarilla x 100m',          'SEGI36', 'rollo',  12000],
    ['Botiquín de Primeros Auxilios Básico',      'SEGI37', 'und',   65000],
    ['Camilla Rígida con Correas',                'SEGI38', 'und',  185000],
    ['Kit de Derrame Hidrocarburos',              'SEGI39', 'und',  245000],
    ['Ducha de Emergencia + Lavaojos',            'SEGI40', 'und',  550000],
    ['Detector de Gas Portátil',                  'SEGI41', 'und',  850000],
    ['Detector de Monóxido CO Fijo',              'SEGI42', 'und',  285000],
    ['Podómetro para Seguridad',                  'SEGI43', 'und',   65000],
    ['Kit Antideslizante para Escaleras',         'SEGI44', 'und',   28000],
    ['Protector de Columna Lumbar',               'SEGI45', 'und',   55000],
    ['Codera de Seguridad Talla M',               'SEGI46', 'par',   22000],
    ['Rodillera de Seguridad Talla M',            'SEGI47', 'par',   28000],
    ['Mameluco de Trabajo Talla L',               'SEGI48', 'und',   85000],
    ['Mameluco de Trabajo Talla XL',              'SEGI49', 'und',   85000],
    ['Delantal de Cuero para Soldador',           'SEGI50', 'und',   65000],
  ],

  // 6 - Tornillería (50 products)
  [
    ['Tornillo Autoperforante 8x1" Punta Broca x100', 'TORN01', 'paq',   6500],
    ['Tornillo Autoperforante 8x1.5" x100',           'TORN02', 'paq',   7500],
    ['Tornillo Autoperforante 10x2" x100',            'TORN03', 'paq',   9500],
    ['Tornillo Autoperforante 12x3" x50',             'TORN04', 'paq',   8500],
    ['Tornillo MDF 3.5x40mm x100',                    'TORN05', 'paq',   6500],
    ['Tornillo MDF 4x50mm x100',                      'TORN06', 'paq',   7500],
    ['Tornillo Drywall 3.5x25mm x100',                'TORN07', 'paq',   5500],
    ['Tornillo Drywall 3.5x35mm x100',                'TORN08', 'paq',   5800],
    ['Tornillo Drywall 4.2x65mm x50',                 'TORN09', 'paq',   5500],
    ['Tornillo de Madera 6x1.5" x100',                'TORN10', 'paq',   8500],
    ['Tornillo de Madera 8x2" x100',                  'TORN11', 'paq',  10500],
    ['Tornillo de Madera 10x3" x50',                  'TORN12', 'paq',   9500],
    ['Tornillo Hexagonal M6x20mm x50',                'TORN13', 'paq',   8500],
    ['Tornillo Hexagonal M8x30mm x25',                'TORN14', 'paq',   9500],
    ['Tornillo Hexagonal M10x40mm x25',               'TORN15', 'paq',  12000],
    ['Perno Hexagonal M6x50mm c/Tuerca x25',          'TORN16', 'paq',  12000],
    ['Perno Hexagonal M8x60mm c/Tuerca x25',          'TORN17', 'paq',  15000],
    ['Perno Hexagonal M10x80mm c/Tuerca x10',         'TORN18', 'paq',  12000],
    ['Tuerca Hexagonal M6 x50',                       'TORN19', 'paq',   4500],
    ['Tuerca Hexagonal M8 x50',                       'TORN20', 'paq',   5500],
    ['Tuerca Hexagonal M10 x25',                      'TORN21', 'paq',   5500],
    ['Tuerca Autoblocante M8 x25',                    'TORN22', 'paq',   7500],
    ['Arandela Plana M6 x100',                        'TORN23', 'paq',   4500],
    ['Arandela Plana M8 x100',                        'TORN24', 'paq',   5500],
    ['Arandela de Presión M8 x100',                   'TORN25', 'paq',   5500],
    ['Arandela de Presión M10 x50',                   'TORN26', 'paq',   5500],
    ['Perno Carrocero 3/8" x 2" x25',                'TORN27', 'paq',  12000],
    ['Perno Expansivo 3/8" x 3" x10',                'TORN28', 'paq',  14000],
    ['Espárrago M8 x 100mm x10',                      'TORN29', 'paq',  12000],
    ['Pasador con Cabeza 5mm x 30mm x50',             'TORN30', 'paq',   8500],
    ['Clavo de Acero 2" x 1kg',                       'TORN31', 'kg',    6500],
    ['Clavo de Acero 3" x 1kg',                       'TORN32', 'kg',    6500],
    ['Clavo de Acero 4" x 1kg',                       'TORN33', 'kg',    6800],
    ['Clavo Galvanizado 2.5" x 1kg',                  'TORN34', 'kg',    8500],
    ['Clavo para Teja 3" x 1kg',                      'TORN35', 'kg',    7500],
    ['Grapa para Grapadora Neumática 1.5" x1000',     'TORN36', 'paq',  12000],
    ['Pin para Pistola 2.7mm x 100',                  'TORN37', 'paq',  18500],
    ['Tornillo Allen M4x10mm x50',                    'TORN38', 'paq',   6500],
    ['Tornillo Allen M5x15mm x50',                    'TORN39', 'paq',   7500],
    ['Tornillo Allen M6x20mm x50',                    'TORN40', 'paq',   8500],
    ['Inserto Roscado M6 x20',                        'TORN41', 'paq',  12000],
    ['Inserto Roscado M8 x20',                        'TORN42', 'paq',  14000],
    ['Ancla Química 300ml',                           'TORN43', 'und',   45000],
    ['Taco para Madera 5mm x100',                    'TORN44', 'paq',    4500],
    ['Taco Plástico Largo 10mm x50',                 'TORN45', 'paq',    5500],
    ['Tornillo de Ojo M8 x10',                        'TORN46', 'paq',   8500],
    ['Grilletes de Acero 5/16" x5',                   'TORN47', 'paq',  12000],
    ['Ángulo Metálico 40x40x3mm x6',                 'TORN48', 'paq',  45000],
    ['Platina Metálica 3mm x 50mm x 1m',             'TORN49', 'und',  28000],
    ['Alambre de Amarre #18 x 1kg',                   'TORN50', 'kg',    8500],
  ],

  // 7 - Adhesivos y Sellantes (50 products)
  [
    ['Pegante Blanco para Madera 250ml',          'ADHV01', 'und',    8500],
    ['Pegante Blanco para Madera 1L',             'ADHV02', 'und',   22000],
    ['Pegante Blanco para Madera 4L',             'ADHV03', 'und',   65000],
    ['Pegante Amarillo de Contacto 250ml',        'ADHV04', 'und',   12000],
    ['Pegante Amarillo de Contacto 1L',           'ADHV05', 'und',   32000],
    ['Pegante Amarillo de Contacto 4L',           'ADHV06', 'und',   85000],
    ['Pegante Epóxico Bicomponente 50ml',         'ADHV07', 'und',   18500],
    ['Pegante Epóxico Bicomponente 500ml',        'ADHV08', 'und',   85000],
    ['Pegante Cianocrilato 20g',                  'ADHV09', 'und',    5500],
    ['Pegante Cianocrilato 50g',                  'ADHV10', 'und',    9500],
    ['Silicona Neutra Blanca 280ml',              'ADHV11', 'und',   14000],
    ['Silicona Neutra Negra 280ml',               'ADHV12', 'und',   14000],
    ['Silicona Neutra Transparente 280ml',        'ADHV13', 'und',   14000],
    ['Silicona Acética Blanca 280ml',             'ADHV14', 'und',   12000],
    ['Silicona para Acuario 280ml',               'ADHV15', 'und',   18500],
    ['Sellador Poliuretano Gris 600ml',           'ADHV16', 'und',   38000],
    ['Sellador Poliuretano Negro 600ml',          'ADHV17', 'und',   38000],
    ['Masilla Epóxica Acero 200g',                'ADHV18', 'und',   22000],
    ['Masilla Epóxica Universal 400g',            'ADHV19', 'und',   32000],
    ['Masilla para Radiador 150g',                'ADHV20', 'und',   18500],
    ['Brea Líquida Impermeabilizante 4L',         'ADHV21', 'und',   45000],
    ['Alquitrán Frío para Techo x Galón',         'ADHV22', 'galon',  32000],
    ['Sikaflex 1A Blanco 300ml',                  'ADHV23', 'und',   28000],
    ['Sikaflex 1A Gris 300ml',                    'ADHV24', 'und',   28000],
    ['Sika Antisol Blanco 4L',                    'ADHV25', 'und',   65000],
    ['Pegante Vinilo para PVC 500ml',             'ADHV26', 'und',   22000],
    ['Pegante para Espuma de Caucho 1L',          'ADHV27', 'und',   35000],
    ['Pegante para Tapicería 1L',                 'ADHV28', 'und',   38000],
    ['Pegante Termofundible Pistola x12 barras',  'ADHV29', 'paq',    8500],
    ['Cinta Doble Faz 1" x 25m',                 'ADHV30', 'und',   12000],
    ['Cinta Doble Faz 2" x 25m',                 'ADHV31', 'und',   18500],
    ['Cinta Espuma Doble Faz 10mm x 3m',          'ADHV32', 'und',    8500],
    ['Cinta Americana Gris 2" x 50m',             'ADHV33', 'und',   22000],
    ['Cinta Americana Negra 2" x 50m',            'ADHV34', 'und',   22000],
    ['Cinta Reflectiva Blanca 2" x 5m',           'ADHV35', 'und',   12000],
    ['Masilla Poliéster para Carrocería 1kg',     'ADHV36', 'und',   28000],
    ['Masilla Automotriz Superfina 500g',         'ADHV37', 'und',   18500],
    ['Limpiador y Desengrasante 500ml',           'ADHV38', 'und',   15000],
    ['Sellador de Juntas Motor 85g',              'ADHV39', 'und',   12000],
    ['Pegante de Impacto Extrafuerte 500ml',      'ADHV40', 'und',   48000],
    ['Resina Poliéster sin Parafina 1kg',         'ADHV41', 'kg',    22000],
    ['Catalizador MEK 125ml',                     'ADHV42', 'und',    8500],
    ['Fibra de Vidrio Mat 300g/m² x 1m²',        'ADHV43', 'und',   28000],
    ['Sellante para Techos Bituminoso 1L',        'ADHV44', 'und',   32000],
    ['Espuma Expansiva Poliuretano 750ml',        'ADHV45', 'und',   28000],
    ['Espuma Selladora para Ventanas 500ml',      'ADHV46', 'und',   22000],
    ['Adhesivo de Contacto Neopreno 1L',          'ADHV47', 'und',   42000],
    ['Primer para Sellantes 250ml',               'ADHV48', 'und',   18500],
    ['Reparador Líquido de Techos 4L',            'ADHV49', 'und',   85000],
    ['Mortero de Reparación Rápido 5kg',          'ADHV50', 'kg',    28000],
  ],
];

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function jitter(base: number, pct = 0.15): number {
  const delta = base * pct;
  return Math.round((base + (Math.random() * 2 - 1) * delta) * 100) / 100;
}


// ──────────────────────────────────────────────────────────────
// Main seeder
// ──────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  console.log('🌱 Starting seed process...');

  try {
    await sequelize.authenticate();
    console.log('✅ Database connected.');

    // Sync schema without altering existing tables
    await sequelize.sync({ alter: false });
    console.log('✅ Schema synchronized.');

    // ── 1. Users ──────────────────────────────────────────────
    console.log('\n📋 Seeding users...');
    const createdUsers: User[] = [];

    for (const u of USERS) {
      const existing = await User.findOne({ where: { username: u.username } });
      if (existing) {
        console.log(`  ↩  User "${u.username}" already exists — skipping.`);
        createdUsers.push(existing);
        continue;
      }
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(u.password, salt);

      // Create directly with raw SQL to bypass the BeforeCreate hook
      // (the hook would re-hash an already-hashed password)
      const user = await User.create(
        { username: u.username, password: hashedPassword, role: u.role },
        { hooks: false }     // skip BeforeCreate so the password is NOT double-hashed
      );
      console.log(`  ✅ User "${u.username}" created (role: ${u.role}).`);
      createdUsers.push(user);
    }

    const adminUser = createdUsers.find(u => u.role === 'admin')!;

    // ── 2. Categories ─────────────────────────────────────────
    console.log('\n📋 Seeding categories...');
    const categoryMap = new Map<string, Category>();

    for (const name of CATEGORY_NAMES) {
      const [cat, created] = await Category.findOrCreate({
        where: { name },
        defaults: { name },
      });
      if (created) {
        console.log(`  ✅ Category "${name}" created.`);
      } else {
        console.log(`  ↩  Category "${name}" already exists — skipping.`);
      }
      categoryMap.set(name, cat);
    }

    // Also ensure the default "Sin categoría" exists
    await Category.findOrCreate({
      where: { name: 'Sin categoría' },
      defaults: { name: 'Sin categoría' },
    });

    // ── 3. Suppliers ──────────────────────────────────────────
    console.log('\n📋 Seeding suppliers...');
    const supplierList: Supplier[] = [];

    for (const s of SUPPLIERS) {
      const [sup, created] = await Supplier.findOrCreate({
        where: { name: s.name },
        defaults: { name: s.name, contact: s.contact, location: s.location },
      });
      if (created) {
        console.log(`  ✅ Supplier "${s.name}" created.`);
      } else {
        console.log(`  ↩  Supplier "${s.name}" already exists — skipping.`);
      }
      supplierList.push(sup);
    }

    // ── 4. Products ───────────────────────────────────────────
    console.log('\n📋 Seeding products...');
    const allProducts: Product[] = [];
    let productCount = 0;

    for (let ci = 0; ci < CATEGORY_NAMES.length; ci++) {
      const catName = CATEGORY_NAMES[ci] as string;
      const cat = categoryMap.get(catName)!;
      const rows = PRODUCTS_BY_CATEGORY[ci] as ProductRow[];

      for (const [name, code, unit, salePrice] of rows) {
        const [prod, created] = await Product.findOrCreate({
          where: { code },
          defaults: { name, code, unit, salePrice, categoryId: cat.id },
        });
        if (created) productCount++;
        allProducts.push(prod);
      }
    }

    console.log(`  ✅ ${productCount} new products created (${allProducts.length} total).`);

    // ── 5. Prices ─────────────────────────────────────────────
    // Seed prices for the first 100 products (2-3 suppliers each)
    console.log('\n📋 Seeding prices...');
    let priceCount = 0;
    const productsToPrice = allProducts.slice(0, 100);

    for (const product of productsToPrice) {
      // Pick 2 or 3 distinct suppliers
      const numSuppliers = Math.random() < 0.5 ? 2 : 3;
      const shuffled = [...supplierList].sort(() => Math.random() - 0.5);
      const chosen = shuffled.slice(0, numSuppliers);

      for (const supplier of chosen) {
        const basePrice = Number(product.salePrice) * 0.75; // cost is ~75 % of sale
        const supplierPrice = jitter(basePrice, 0.12);

        const existing = await Price.findOne({
          where: {
            productId: product.id,
            supplierId: supplier.id,
          },
        });

        if (!existing) {
          await Price.create({
            productId: product.id,
            supplierId: supplier.id,
            price: supplierPrice,
            updatedByUserId: adminUser.id,
          });
          priceCount++;
        }
      }
    }

    console.log(`  ✅ ${priceCount} new prices created.`);

    // ── Summary ───────────────────────────────────────────────
    const totalUsers      = await User.count();
    const totalCategories = await Category.count();
    const totalSuppliers  = await Supplier.count();
    const totalProducts   = await Product.count();
    const totalPrices     = await Price.count();

    console.log('\n🎉 Seed completed successfully!');
    console.log('─'.repeat(40));
    console.log(`  Users:      ${totalUsers}`);
    console.log(`  Categories: ${totalCategories}`);
    console.log(`  Suppliers:  ${totalSuppliers}`);
    console.log(`  Products:   ${totalProducts}`);
    console.log(`  Prices:     ${totalPrices}`);
    console.log('─'.repeat(40));

  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('✅ Database connection closed.');
  }
}

// Run
void seed();
