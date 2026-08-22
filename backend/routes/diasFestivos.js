import { Router } from 'express'
import * as diaFestivoController from '../controllers/diaFestivoController.js'
import { validarCamposRequeridos, validarFecha } from '../middlewares/validator.js'

const router = Router()

router.get('/', diaFestivoController.getDiasFestivos)
router.post('/', validarCamposRequeridos(['fecha', 'motivo']), validarFecha('fecha'), diaFestivoController.createDiaFestivo)
router.put('/:id', diaFestivoController.updateDiaFestivo)
router.delete('/:id', diaFestivoController.deleteDiaFestivo)
router.post('/importar', diaFestivoController.importarDiasFestivos)

export default router
