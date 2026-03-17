import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import * as agentController from '../controllers/agentController.js';

const router = Router();

router.use(authenticateToken);

router.post('/turn', agentController.turn);
router.post('/index-context', agentController.indexContext);
router.post('/retrieve', agentController.retrieveContext);

export default router;
