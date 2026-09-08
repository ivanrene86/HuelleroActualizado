import { Router } from 'express'
import * as claseController from '../controllers/claseController.js'
import { autenticarJWT } from '../middlewares/auth.js'

const router = Router()

router.post('/activar', autenticarJWT, claseController.activar)
router.post('/finalizar', autenticarJWT, claseController.finalizar)

export default router
