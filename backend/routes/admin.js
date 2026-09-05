import { Router } from 'express'
import * as adminController from '../controllers/adminController.js'
import { autenticarJWT, verificarRol } from '../middlewares/auth.js'

const router = Router()

router.get('/perfil', autenticarJWT, verificarRol(['Administrador']), adminController.getPerfil)
router.put('/perfil', autenticarJWT, verificarRol(['Administrador']), adminController.updatePerfil)

export default router
