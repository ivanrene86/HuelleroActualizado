import { Router } from 'express'
import * as dispositivoController from '../controllers/dispositivoController.js'

const router = Router()

router.post('/registrar', dispositivoController.registrar)

export default router
