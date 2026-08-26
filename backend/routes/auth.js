import { Router } from 'express'
import * as authController from '../controllers/authController.js'
import { validarCamposRequeridos, validarEmail } from '../middlewares/validator.js'

const router = Router()

router.post('/login', validarCamposRequeridos(['correo', 'password']), authController.login)
router.get('/perfil', authController.getPerfil)
router.put('/perfil', authController.updatePerfil)
router.post('/recovery-code', validarCamposRequeridos(['correo']), validarEmail('correo'), authController.recoveryCode)
router.post('/reset-password', validarCamposRequeridos(['correo', 'nuevaPassword']), validarEmail('correo'), authController.resetPassword)
router.post('/cambiar-password', validarCamposRequeridos(['passwordActual', 'nuevaPassword']), authController.cambiarPassword)

export default router
