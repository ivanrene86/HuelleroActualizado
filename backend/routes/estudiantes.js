import { Router } from 'express'
import * as estudianteController from '../controllers/estudianteController.js'
import { validarCamposRequeridos, validarEmail } from '../middlewares/validator.js'

const router = Router()

// Operaciones CRUD
router.get('/', estudianteController.getEstudiantes)
router.post('/', validarCamposRequeridos(['nombres', 'apellidos', 'numeroDocumento', 'fichaId']), validarEmail('correo'), estudianteController.createEstudiante)
router.put('/:id', estudianteController.updateEstudiante)
router.delete('/:id', estudianteController.deleteEstudiante)
router.post('/importar', estudianteController.importarEstudiantes)

// SDK Biométrico y Enrolamiento U.are.U 4500
router.post('/enroll-start', estudianteController.enrollStart)
router.post('/enroll-capture', estudianteController.enrollCapture)
router.post('/enroll-complete', estudianteController.enrollComplete)
router.post('/enroll-cancel', estudianteController.enrollCancel)
router.post('/verify', estudianteController.verifyFingerprint)
router.get('/fingerprint-status', estudianteController.getFingerprintStatus)
router.put('/:id/enrolar-huella', estudianteController.enrolarHuellaLegacy)

export default router
