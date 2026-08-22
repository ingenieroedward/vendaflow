import { CashSession } from './cash-session.model';
import { User } from '../user/user.model';
import { NotFoundError, ConflictError } from '@/core/errors/AppError';
import { validateSchema } from '@/core/utils/validation';
import { openSessionSchema, closeSessionSchema, OpenSessionDto, CloseSessionDto } from './pos.dto';

export class PosService {
  // v1: una sola caja por tenant a la vez (sin multi-caja simultánea —
  // ver alcance en PLAN-FEATURES-Y-POS.md). Cualquier vendedor puede operar
  // el turno que otro dejó abierto (relevo de cajero).
  async getCurrentSession(tenantId: number): Promise<CashSession | null> {
    return CashSession.findOne({
      where: { tenantId, status: 'open' },
      include: [{ model: User, attributes: ['id', 'username'] }],
    });
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

  async closeSession(tenantId: number, sessionId: number, data: CloseSessionDto): Promise<CashSession> {
    const validated = validateSchema(closeSessionSchema, data);
    const session = await CashSession.findOne({ where: { id: sessionId, tenantId, status: 'open' } });
    if (!session) throw new NotFoundError('No hay una caja abierta con ese id');

    // Fase 1: sin ventas del POS integradas todavía — expectedCash es solo
    // la base inicial. Fase 3 sumará aquí las ventas en efectivo del turno
    // (cuando exista el endpoint de venta con método de pago).
    const expectedCash = Number(session.openingAmount);
    const difference = validated.countedCash - expectedCash;

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
    return session;
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
