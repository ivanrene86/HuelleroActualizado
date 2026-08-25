import { Router } from 'express'
import * as asistenciaController from '../controllers/asistenciaController.js'
import { validarCamposRequeridos, validarFecha } from '../middlewares/validator.js'

const router = Router()

router.get('/', validarFecha('fecha'), asistenciaController.getAsistencias)
router.post('/', validarCamposRequeridos(['estudianteId', 'fichaId', 'fecha', 'estado']), validarFecha('fecha'), asistenciaController.createAsistencia)
router.post('/inhabilitar-jornada', validarCamposRequeridos(['fichaId', 'fecha']), validarFecha('fecha'), asistenciaController.inhabilitarJornada)
router.post('/reactivar-jornada', validarCamposRequeridos(['fichaId', 'fecha']), validarFecha('fecha'), asistenciaController.reactivarJornada)
router.get('/sqlite/download', asistenciaController.downloadSqlite)
router.post('/sqlite/sync-all', asistenciaController.syncAllSqlite)

export default router
