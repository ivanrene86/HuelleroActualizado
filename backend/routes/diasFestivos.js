import { Router } from 'express'
import * as diaFestivoController from '../controllers/diaFestivoController.js'
import { validarCamposRequeridos, validarFecha } from '../middlewares/validator.js'
import { autenticarJWT, verificarRol, autenticarOpcional } from '../middlewares/auth.js'

const router = Router()

router.get('/', autenticarOpcional, diaFestivoController.getDiasFestivos)

router.post('/',
  autenticarJWT,
  verificarRol(['Administrador']),
  validarCamposRequeridos(['fecha', 'motivo']),
  validarFecha('fecha'),
  diaFestivoController.createDiaFestivo
)

router.put('/:id',
  autenticarJWT,
  verificarRol(['Administrador']),
  diaFestivoController.updateDiaFestivo
)

router.delete('/:id',
  autenticarJWT,
  verificarRol(['Administrador']),
  diaFestivoController.deleteDiaFestivo
)

router.post('/importar',
  autenticarJWT,
  verificarRol(['Administrador']),
  diaFestivoController.importarDiasFestivos
)

export default router
