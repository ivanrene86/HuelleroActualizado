import { Router } from 'express'
import * as adminController from '../controllers/adminController.js'

const router = Router()

router.get('/perfil', adminController.getPerfil)
router.put('/perfil', adminController.updatePerfil)

export default router
