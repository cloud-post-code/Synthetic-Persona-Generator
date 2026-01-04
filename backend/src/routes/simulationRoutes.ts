import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import * as simulationController from '../controllers/simulationController.js';
import * as simulationTemplateController from '../controllers/simulationTemplateController.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// IMPORTANT: Specific routes must come before parameterized routes
router.get('/templates', simulationTemplateController.getActiveSimulations);
router.get('/', simulationController.getSimulationSessions);
router.get('/:id', simulationController.getSimulationSession);
router.post('/', simulationController.createSimulationSession);
router.put('/:id', simulationController.updateSimulationSession);
router.delete('/:id', simulationController.deleteSimulationSession);

export default router;

