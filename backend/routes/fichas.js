import { Router } from 'express'
import * as fichaController from '../controllers/fichaController.js'
import { validarCamposRequeridos } from '../middlewares/validator.js'

const router = Router()

router.get('/', fichaController.getFichas)
router.get('/mis-fichas/:instructorId', fichaController.getMisFichas)
router.post('/', validarCamposRequeridos(['codigoFicha', 'nombrePrograma', 'jornada']), fichaController.createFicha)
router.put('/:id', fichaController.updateFicha)
router.delete('/:id', fichaController.deleteFicha)
router.post('/importar', fichaController.importarFichas)

export default router
