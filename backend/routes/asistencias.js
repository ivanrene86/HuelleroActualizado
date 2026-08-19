import { Router } from 'express'
import Asistencia from '../models/Asistencia.js'
import Estudiante from '../models/Estudiante.js'
import Ficha from '../models/Ficha.js'
import { upsertAsistenciaSQLite, upsertAsistenciasBatchSQLite, getSqliteFilePath, checkpointSQLite } from '../services/sqliteExport.js'
import fs from 'fs'
import mongoose from 'mongoose'

const router = Router()

async function getFichaIdList(fichaId) {
  if (!fichaId) return []
  const ids = []
  if (mongoose.Types.ObjectId.isValid(fichaId)) {
    ids.push(new mongoose.Types.ObjectId(fichaId))
  }
  try {
    const queryFicha = []
    if (mongoose.Types.ObjectId.isValid(fichaId)) {
      queryFicha.push({ _id: fichaId })
    }
    queryFicha.push({ codigoFicha: String(fichaId).trim() })
    const fichaDoc = await Ficha.findOne({ $or: queryFicha })
    if (fichaDoc) {
      const docId = fichaDoc._id
      if (!ids.some(id => String(id) === String(docId))) {
        ids.push(docId)
      }
    }
  } catch (e) {}
  return ids
}

router.get('/', async (req, res) => {
  try {
    const { fichaId, fecha, fechaDesde, fechaHasta } = req.query
    const filter = {}
    if (fichaId) {
      const idsBuscar = await getFichaIdList(fichaId)
      filter.fichaId = { $in: idsBuscar }
    }
    if (fecha) filter.fecha = fecha
    if (fechaDesde || fechaHasta) {
      filter.fecha = {}
      if (fechaDesde) filter.fecha.$gte = fechaDesde
      if (fechaHasta) filter.fecha.$lte = fechaHasta
    }
    const asistencias = await Asistencia.find(filter).populate('estudianteId').populate('instructorId').sort({ fecha: 1, createdAt: 1 })
    res.json(asistencias)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

function getHoyString() {
  const ahora = new Date()
  const offsetMs = ahora.getTimezoneOffset() * 60000
  const localDate = new Date(ahora.getTime() - offsetMs)
  return localDate.toISOString().split('T')[0]
}

router.post('/', async (req, res) => {
  try {
    const { estudianteId, fichaId, fecha, estado, hora, horasTardanza, tiempoTardanza, motivoInhabilitacion, instructorId } = req.body
    
    if (fecha && fecha > getHoyString()) {
      return res.status(400).json({ error: 'No es posible registrar asistencias en fechas futuras.' })
    }

    // 1. Guardar en MongoDB Atlas
    const asistencia = await Asistencia.findOneAndUpdate(
      { estudianteId, fichaId, fecha },
      {
        estudianteId,
        fichaId,
        fecha,
        estado,
        hora: hora || '—',
        horasTardanza: horasTardanza || 0,
        tiempoTardanza: tiempoTardanza || (horasTardanza ? `${horasTardanza} ${horasTardanza === 1 ? 'hora' : 'horas'}` : '0 horas'),
        motivoInhabilitacion: motivoInhabilitacion || '',
        instructorId: instructorId || null
      },
      { new: true, upsert: true }
    )

    if (estado !== 'Inhabilitada') {
      await Estudiante.findByIdAndUpdate(estudianteId, { estadoAsistencia: estado })
    }

    // 2. Sincronizar automáticamente con el archivo SQLite único (sin motivo privado)
    try {
      const [estudianteDoc, fichaDoc] = await Promise.all([
        Estudiante.findById(estudianteId),
        Ficha.findById(fichaId)
      ])

      if (estudianteDoc && fichaDoc) {
        upsertAsistenciaSQLite({
          fichaCodigo: fichaDoc.codigoFicha || String(fichaId),
          nombrePrograma: fichaDoc.nombrePrograma || '',
          jornada: fichaDoc.jornada || '',
          documentoAprendiz: estudianteDoc.numeroDocumento || '',
          nombreAprendiz: `${estudianteDoc.nombres || ''} ${estudianteDoc.apellidos || ''}`.trim(),
          correoAprendiz: estudianteDoc.correo || '',
          fecha: fecha,
          estado: estado,
          hora: hora || '—',
          horasTardanza: horasTardanza || 0,
          tiempoTardanza: tiempoTardanza || '0 horas'
        })
      }
    } catch (sqliteErr) {
      console.warn('[SQLite] Error en sincronización individual:', sqliteErr.message)
    }

    res.status(201).json(asistencia)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/inhabilitar-jornada', async (req, res) => {
  try {
    const { fichaId, fecha, motivo, instructorId } = req.body
    if (!fichaId || !fecha) {
      return res.status(400).json({ error: 'fichaId y fecha son requeridos' })
    }

    if (fecha > getHoyString()) {
      return res.status(400).json({ error: 'No es posible inhabilitar jornadas en fechas futuras.' })
    }

    const idsBuscar = await getFichaIdList(fichaId)
    const [estudiantes, fichaDoc] = await Promise.all([
      Estudiante.find({ fichaId: { $in: idsBuscar }, estado: { $ne: 'Retirado' } }),
      Ficha.findOne({ $or: [{ _id: mongoose.Types.ObjectId.isValid(fichaId) ? fichaId : null }, { codigoFicha: String(fichaId).trim() }] })
    ])
    const motivoFinal = motivo || 'Jornada no impartida / Actividad institucional'

    console.log(`[inhabilitar-jornada] fichaId=${fichaId}, estudiantes encontrados: ${estudiantes.length}, fecha=${fecha}`)

    const operaciones = estudiantes.map(est => ({
      updateOne: {
        filter: { estudianteId: est._id, fecha },
        update: {
          $set: {
            estudianteId: est._id,
            fichaId: fichaDoc?._id || fichaId,
            fecha,
            estado: 'Inhabilitada',
            hora: '—',
            horasTardanza: 0,
            tiempoTardanza: '0 horas',
            motivoInhabilitacion: motivoFinal,
            instructorId: instructorId || null
          }
        },
        upsert: true
      }
    }))

    if (operaciones.length > 0) {
      await Asistencia.bulkWrite(operaciones)

      // Sincronizar en lote a SQLite
      if (fichaDoc) {
        const sqliteRows = estudiantes.map(est => ({
          fichaCodigo: fichaDoc.codigoFicha || String(fichaId),
          nombrePrograma: fichaDoc.nombrePrograma || '',
          jornada: fichaDoc.jornada || '',
          documentoAprendiz: est.numeroDocumento || '',
          nombreAprendiz: `${est.nombres || ''} ${est.apellidos || ''}`.trim(),
          correoAprendiz: est.correo || '',
          fecha: fecha,
          estado: 'Inhabilitada',
          hora: '—',
          horasTardanza: 0,
          tiempoTardanza: '0 horas'
        }))
        upsertAsistenciasBatchSQLite(sqliteRows)
      }
    }

    res.json({ ok: true, count: operaciones.length, motivo: motivoFinal })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/reactivar-jornada', async (req, res) => {
  try {
    const { fichaId, fecha } = req.body
    if (!fichaId || !fecha) {
      return res.status(400).json({ error: 'fichaId y fecha son requeridos' })
    }

    const idsBuscar = await getFichaIdList(fichaId)
    await Asistencia.deleteMany({ fichaId: { $in: idsBuscar }, fecha, estado: 'Inhabilitada' })
    res.json({ ok: true, message: 'Jornada reactivada exitosamente' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Descarga directa del archivo SQLite único de la institución
router.get('/sqlite/download', async (req, res) => {
  try {
    const filePath = getSqliteFilePath()

    // Sincronizar siempre todos los registros de MongoDB hacia SQLite para asegurar que el archivo esté 100% al día
    const asistencias = await Asistencia.find()
      .populate('estudianteId')
      .populate('fichaId')

    const rows = []
    for (const a of asistencias) {
      if (!a.estudianteId || !a.fichaId) continue
      rows.push({
        fichaCodigo: a.fichaId.codigoFicha || String(a.fichaId._id || a.fichaId),
        nombrePrograma: a.fichaId.nombrePrograma || '',
        jornada: a.fichaId.jornada || '',
        documentoAprendiz: a.estudianteId.numeroDocumento || '',
        nombreAprendiz: `${a.estudianteId.nombres || ''} ${a.estudianteId.apellidos || ''}`.trim(),
        correoAprendiz: a.estudianteId.correo || '',
        fecha: a.fecha,
        estado: a.estado,
        hora: a.hora || '—',
        horasTardanza: a.horasTardanza || 0,
        tiempoTardanza: a.tiempoTardanza || '0 horas'
      })
    }
    upsertAsistenciasBatchSQLite(rows)
    checkpointSQLite()

    res.setHeader('Content-Type', 'application/vnd.sqlite3')
    res.setHeader('Content-Disposition', 'attachment; filename="asistencias_institucion.sqlite"')
    res.download(filePath, 'asistencias_institucion.sqlite')
  } catch (err) {
    console.error('[SQLite] Error en descarga:', err)
    res.status(500).json({ error: err.message })
  }
})

// Sincronizar todo el historial de MongoDB Atlas hacia SQLite
router.post('/sqlite/sync-all', async (req, res) => {
  try {
    const asistencias = await Asistencia.find()
      .populate('estudianteId')
      .populate('fichaId')

    const rows = []
    for (const a of asistencias) {
      if (!a.estudianteId || !a.fichaId) continue
      rows.push({
        fichaCodigo: a.fichaId.codigoFicha || String(a.fichaId._id || a.fichaId),
        nombrePrograma: a.fichaId.nombrePrograma || '',
        jornada: a.fichaId.jornada || '',
        documentoAprendiz: a.estudianteId.numeroDocumento || '',
        nombreAprendiz: `${a.estudianteId.nombres || ''} ${a.estudianteId.apellidos || ''}`.trim(),
        correoAprendiz: a.estudianteId.correo || '',
        fecha: a.fecha,
        estado: a.estado,
        hora: a.hora || '—',
        horasTardanza: a.horasTardanza || 0,
        tiempoTardanza: a.tiempoTardanza || '0 horas'
      })
    }

    const resultado = upsertAsistenciasBatchSQLite(rows)
    res.json({ ok: true, total: rows.length, ...resultado })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
