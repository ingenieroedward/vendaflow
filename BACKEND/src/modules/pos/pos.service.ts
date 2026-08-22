import { CashSession } from './cash-session.model';
import { PosSalePayment, PosPaymentMethod } from './pos-sale-payment.model';
import { User } from '../user/user.model';
import { Customer, CustomerAttributes } from '../customer/customer.model';
import { OrderService } from '../order/order.service';
import { computeOrderTotal } from '../order/order-totals';
import { NotFoundError, ConflictError, BadRequestError } from '@/core/errors/AppError';
import { validateSchema } from '@/core/utils/validation';
import { openSessionSchema, closeSessionSchema, posSaleSchema, OpenSessionDto, CloseSessionDto, PosSaleDto } from './pos.dto';

const DEFAULT_CUSTOMER_NAME = 'Consumidor final';
const EPSILON = 0.01; // tolerancia de redondeo en centavos

interface PaymentsByMethod {
  cash: number;
  card: number;
  transfer: number;
  other: number;
  total: number;
}

async function sumByMethod(tenantId: number, cashSessionId: number): Promise<PaymentsByMethod> {
  const rows = await PosSalePayment.findAll({
    where: { tenantId, cashSessionId },
    attributes: ['method', 'amount'],
    raw: true,
  });
  const out: PaymentsByMethod = { cash: 0, card: 0, transfer: 0, other: 0, total: 0 };
  for (const r of rows) {
    const amount = Number(r.amount);
    out[r.method as PosPaymentMethod] += amount;
    out.total += amount;
  }
  return out;
}

export class PosService {
  private orderService = new OrderService();

  /**
   * Venta de mostrador: exige caja abierta, reusa OrderService.createOrder
   * (mismo motor de stock/IVA/cuota/idempotencia que Orders) marcada
   * source='pos' + cashSessionId. Sin customerId → "Consumidor final"
   * (se crea una sola vez por tenant, findOrCreate).
   *
   * Pago mixto: `payments` debe sumar exacto al total de los items (se
   * valida ANTES de tocar stock/crear la orden, para no dejar ventas a
   * medias). `cashReceived` es el efectivo físico entregado por el cliente
   * — solo sirve para calcular el vuelto, nunca afecta el total cobrado.
   */
  async sale(tenantId: number, userId: number, data: PosSaleDto) {
    const validated = validateSchema(posSaleSchema, data);

    const session = await CashSession.findOne({ where: { tenantId, status: 'open' } });
    if (!session) throw new ConflictError('Abre la caja antes de vender');

    const expectedTotal = computeOrderTotal(validated.items);
    const paidTotal = validated.payments.reduce((s, p) => s + p.amount, 0);
    if (Math.abs(paidTotal - expectedTotal) > EPSILON) {
      throw new BadRequestError(
        `Los pagos ($${paidTotal.toLocaleString('es-CO')}) no cuadran con el total de la venta ($${expectedTotal.toLocaleString('es-CO')})`,
      );
    }

    const cashPayment = validated.payments.filter(p => p.method === 'cash').reduce((s, p) => s + p.amount, 0);
    let changeGiven: number | null = null;
    if (validated.cashReceived !== undefined) {
      if (validated.cashReceived < cashPayment - EPSILON) {
        throw new BadRequestError('El efectivo recibido es menor al monto que se está pagando en efectivo');
      }
      changeGiven = Math.round((validated.cashReceived - cashPayment) * 100) / 100;
    }

    let customerId = validated.customerId;
    if (!customerId) {
      const [customer] = await Customer.findOrCreate({
        where: { tenantId, name: DEFAULT_CUSTOMER_NAME },
        defaults: { tenantId, name: DEFAULT_CUSTOMER_NAME } as CustomerAttributes,
      });
      customerId = customer.id;
    } else {
      const customer = await Customer.findOne({ where: { id: customerId, tenantId } });
      if (!customer) throw new NotFoundError('Cliente no encontrado');
    }

    const order = await this.orderService.createOrder(
      {
        customerId,
        items: validated.items,
        status: 'completed',
        notes: validated.notes,
        paymentType: 'cash',
        source: 'pos',
        cashSessionId: session.id,
        changeGiven,
      } as Parameters<OrderService['createOrder']>[0],
      userId,
      tenantId,
    );

    // La orden ya está creada y cobrada — si esto falla, la venta sigue
    // siendo válida (solo se pierde el desglose fino por método, no el dinero).
    try {
      await PosSalePayment.bulkCreate(
        validated.payments.map(p => ({
          tenantId, orderId: order.id, cashSessionId: session.id, method: p.method, amount: p.amount,
        })),
      );
    } catch {
      // best-effort — ver comentario arriba
    }

    return { ...order, changeGiven, payments: validated.payments };
  }

  // v1: una sola caja por tenant a la vez (sin multi-caja simultánea —
  // ver alcance en PLAN-FEATURES-Y-POS.md). Cualquier vendedor puede operar
  // el turno que otro dejó abierto (relevo de cajero).
  async getCurrentSession(tenantId: number) {
    const session = await CashSession.findOne({
      where: { tenantId, status: 'open' },
      include: [{ model: User, attributes: ['id', 'username'] }],
    });
    if (!session) return null;
    const salesByMethod = await sumByMethod(tenantId, session.id);
    return { ...session.toJSON(), salesByMethod };
  }

  async openSession(tenantId: number, userId: number, data: OpenSessionDto): Promise<CashSession> {
    const validated = validateSchema(openSessionSchema, data);
    const existing = await CashSession.findOne({ where: { tenantId, status: 'open' } });
    if (existing) throw new ConflictError('Ya hay una caja abierta — ciérrala antes de abrir una nueva');

    return CashSession.create({
      tenantId,
      userId,
      openedAt: new Date(),
      closedAt: null,
      openingAmount: validated.openingAmount,
      expectedCash: null,
      countedCash: null,
      difference: null,
      status: 'open',
      notes: validated.notes ?? null,
    });
  }

  async closeSession(tenantId: number, sessionId: number, data: CloseSessionDto) {
    const validated = validateSchema(closeSessionSchema, data);
    const session = await CashSession.findOne({ where: { id: sessionId, tenantId, status: 'open' } });
    if (!session) throw new NotFoundError('No hay una caja abierta con ese id');

    // expectedCash = base inicial + ventas en efectivo real del turno
    // (tarjeta/transferencia no entran a la caja física, no se cuentan aquí)
    const salesByMethod = await sumByMethod(tenantId, session.id);
    const expectedCash = Number(session.openingAmount) + salesByMethod.cash;
    const difference = Math.round((validated.countedCash - expectedCash) * 100) / 100;

    await session.update({
      closedAt: new Date(),
      countedCash: validated.countedCash,
      expectedCash,
      difference,
      status: 'closed',
      notes: validated.notes
        ? `${session.notes ? session.notes + ' | ' : ''}${validated.notes}`
        : session.notes,
    });
    return { ...session.toJSON(), salesByMethod };
  }

  async listSessions(tenantId: number, limit = 20): Promise<CashSession[]> {
    return CashSession.findAll({
      where: { tenantId },
      order: [['openedAt', 'DESC']],
      limit,
      include: [{ model: User, attributes: ['id', 'username'] }],
    });
  }
}
