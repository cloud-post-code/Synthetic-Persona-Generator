import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import * as simulationController from '../controllers/simulationController.js';
import * as simulationTemplateController from '../controllers/simulationTemplateController.js';
import * as simulationTemplateUserController from '../controllers/simulationTemplateUserController.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Simulation templates — specific paths before /templates/:id
router.get('/templates/mine', simulationTemplateUserController.getMine);
router.get('/templates/library', simulationTemplateUserController.getLibrary);
router.get('/templates/starred', simulationTemplateUserController.getStarred);
router.post('/templates/preview-prompt', simulationTemplateUserController.previewSystemPromptUser);
router.post('/templates', simulationTemplateUserController.createUserTemplate);
router.get('/templates/:id', simulationTemplateUserController.getTemplateById);
router.put('/templates/:id', simulationTemplateUserController.updateUserTemplate);
router.delete('/templates/:id', simulationTemplateUserController.deleteUserTemplate);
router.post('/templates/:id/star', simulationTemplateUserController.starTemplate);
router.delete('/templates/:id/star', simulationTemplateUserController.unstarTemplate);
router.get('/templates', simulationTemplateController.getActiveSimulations);

router.get('/', simulationController.getSimulationSessions);
router.get('/:id', simulationController.getSimulationSession);
router.get('/:id/persuasion-context', simulationController.getPersuasionContext);
router.post('/', simulationController.createSimulationSession);
router.post('/:id/messages', simulationController.createSimulationMessage);
router.post('/:id/messages/bulk', simulationController.createSimulationMessagesBulk);
router.put('/:id', simulationController.updateSimulationSession);
router.delete('/:id', simulationController.deleteSimulationSession);

export default router;
