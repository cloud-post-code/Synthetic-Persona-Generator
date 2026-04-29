import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import * as voiceController from '../controllers/voiceController.js';

const router = Router();
router.use(authenticateToken);
router.post('/intent', voiceController.intent);

export default router;
