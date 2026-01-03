import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import * as simulationController from '../controllers/simulationController.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/', simulationController.getSimulationSessions);
router.get('/:id', simulationController.getSimulationSession);
router.post('/', simulationController.createSimulationSession);
router.put('/:id', simulationController.updateSimulationSession);
router.delete('/:id', simulationController.deleteSimulationSession);

export default router;

