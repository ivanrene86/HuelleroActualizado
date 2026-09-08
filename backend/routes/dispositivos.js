import { Router } from 'express'
import * as dispositivoController from '../controllers/dispositivoController.js'
import { autenticarJWT, verificarRol } from '../middlewares/auth.js'

const router = Router()

router.post('/registrar', dispositivoController.registrar)
router.get('/', autenticarJWT, verificarRol(['Administrador']), dispositivoController.getDispositivos)
router.put('/:id/fichas', autenticarJWT, verificarRol(['Administrador']), dispositivoController.asociarFichas)

export default router
