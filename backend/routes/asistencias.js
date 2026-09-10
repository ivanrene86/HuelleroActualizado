import { Router } from 'express'
import * as asistenciaController from '../controllers/asistenciaController.js'
import { validarCamposRequeridos, validarFecha } from '../middlewares/validator.js'
import { autenticarJWT, verificarRol, autenticarOpcional } from '../middlewares/auth.js'

const router = Router()

// Consulta y Registro de Asistencias (permitido para Kiosco de Aula y paneles autenticados)
router.get('/', autenticarOpcional, validarFecha('fecha'), asistenciaController.getAsistencias)
router.post('/', autenticarOpcional, validarCamposRequeridos(['estudianteId', 'fichaId', 'fecha', 'estado']), validarFecha('fecha'), asistenciaController.createAsistencia)

// Control de Jornadas (requiere Administrador o Instructor)
router.post('/inhabilitar-jornada',
  autenticarJWT,
  verificarRol(['Administrador', 'Instructor']),
  validarCamposRequeridos(['fichaId', 'fecha']),
  validarFecha('fecha'),
  asistenciaController.inhabilitarJornada
)

router.post('/reactivar-jornada',
  autenticarJWT,
  verificarRol(['Administrador', 'Instructor']),
  validarCamposRequeridos(['fichaId', 'fecha']),
  validarFecha('fecha'),
  asistenciaController.reactivarJornada
)

// Gestión de base de datos SQLite offline
router.get('/sqlite/download', autenticarJWT, verificarRol(['Administrador']), asistenciaController.downloadSqlite)
router.get('/sqlite/ficha/:codigoFicha', autenticarJWT, verificarRol(['Administrador', 'Instructor']), asistenciaController.downloadSqliteFicha)
router.post('/sqlite/sync-all', autenticarJWT, verificarRol(['Administrador']), asistenciaController.syncAllSqlite)
router.post('/sqlite/sync-fichas', autenticarJWT, verificarRol(['Administrador']), asistenciaController.ejecutarSincronizacionFichas)

export default router
