import { Router } from 'express';
import { QuoteController } from './quote.controller';
import { isAuth, isAdmin, isSeller } from '@/core/middlewares/auth';

const router = Router();
const quoteController = new QuoteController();

// Protected routes (all require auth) — tenantGuard + requireFeature('quotes') ya
// aplicados al montar el router en app.ts
router.get('/', isAuth, isSeller, quoteController.getAllQuotes);
router.get('/search', isAuth, isSeller, quoteController.searchQuotes);
router.get('/next-number', isAuth, isSeller, quoteController.getNextQuoteNumber);
router.get('/trash', isAuth, isAdmin, quoteController.getDeletedQuotes);
router.get('/customer/:customerId', isAuth, isSeller, quoteController.getQuotesByCustomer);
router.get('/:id', isAuth, isSeller, quoteController.getQuoteById);

router.post('/', isAuth, isSeller, quoteController.createQuote);
router.post('/:id/convert', isAuth, isSeller, quoteController.convertToOrder);
router.post('/:id/restore', isAuth, isAdmin, quoteController.restoreQuote);
router.put('/:id', isAuth, isSeller, quoteController.updateQuote);
router.delete('/:id/permanent', isAuth, isAdmin, quoteController.hardDeleteQuote);
router.delete('/:id', isAuth, isAdmin, quoteController.deleteQuote);

export default router;
