import { Router } from 'express'
import * as instructorController from '../controllers/instructorController.js'
import { validarCamposRequeridos, validarEmail } from '../middlewares/validator.js'

const router = Router()

router.get('/', instructorController.getInstructores)
router.post('/', validarCamposRequeridos(['nombres', 'apellidos', 'numeroDocumento', 'correo']), validarEmail('correo'), instructorController.createInstructor)
router.put('/:id', instructorController.updateInstructor)
router.delete('/:id', instructorController.deleteInstructor)
router.post('/importar', instructorController.importarInstructores)

export default router
