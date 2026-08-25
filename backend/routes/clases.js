import { Router } from 'express'
import * as claseController from '../controllers/claseController.js'

const router = Router()

router.post('/activar', claseController.activar)

export default router
