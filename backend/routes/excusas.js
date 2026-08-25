import { Router } from 'express'
import * as excusaController from '../controllers/excusaController.js'
import { validarCamposRequeridos } from '../middlewares/validator.js'

const router = Router()

router.get('/', excusaController.getExcusas)
router.post('/', validarCamposRequeridos(['estudianteId', 'fichaId', 'fechaInasistencia', 'motivo']), excusaController.createExcusa)
router.put('/:id', excusaController.updateExcusa)
router.put('/:id/aprobar', excusaController.aprobarExcusa)
router.put('/:id/rechazar', excusaController.rechazarExcusa)

export default router
