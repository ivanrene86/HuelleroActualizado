import Asistencia from '../models/Asistencia.js'
import Estudiante from '../models/Estudiante.js'
import Ficha from '../models/Ficha.js'
import Instructor from '../models/Instructor.js'
import mongoose from 'mongoose'
import { getFichaIdList, getHoyString } from '../services/asistenciaService.js'
import {
  upsertAsistenciaSQLite,
  upsertAsistenciasBatchSQLite,
  getSqliteFilePath,
  checkpointSQLite
} from '../services/sqliteExport.js'

export async function getAsistencias(req, res) {
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
    const asistencias = await Asistencia.find(filter)
      .populate('estudianteId')
      .populate('instructorId')
      .sort({ fecha: 1, createdAt: 1 })
    res.json(asistencias)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function createAsistencia(req, res) {
  try {
    const {
      estudianteId,
      fichaId,
      fecha,
      estado,
      hora,
      horasTardanza,
      tiempoTardanza,
      motivoInhabilitacion,
      instructorId
    } = req.body

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

    // 2. Sincronizar automáticamente con el archivo SQLite único y por ficha
    try {
      const [estudianteDoc, fichaDoc, instructorDoc] = await Promise.all([
        Estudiante.findById(estudianteId),
        Ficha.findById(fichaId),
        instructorId ? Instructor.findById(instructorId) : null
      ])

      if (estudianteDoc && fichaDoc) {
        const itemSqlite = {
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
          tiempoTardanza: tiempoTardanza || '0 horas',
          instructorId: instructorDoc ? String(instructorDoc._id) : null,
          instructorNombre: instructorDoc ? `${instructorDoc.nombres || ''} ${instructorDoc.apellidos || ''}`.trim() : null,
          instructorEspecialidad: instructorDoc?.especialidad || null,
        }

        // Guardar en base global
        upsertAsistenciaSQLite(itemSqlite)

        // Guardar también en la base individual de la ficha
        try {
          const { getDBFicha } = await import('../services/sqliteExport.js')
          const { db } = getDBFicha(fichaDoc.codigoFicha)
          upsertAsistenciaSQLite(itemSqlite, db)
          db.close()
        } catch (eFicha) {}
      }
    } catch (sqliteErr) {
      console.warn('[SQLite] Error en sincronización individual:', sqliteErr.message)
    }

    res.status(201).json(asistencia)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function inhabilitarJornada(req, res) {
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
}

export async function reactivarJornada(req, res) {
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
}

export async function downloadSqlite(req, res) {
  try {
    const filePath = getSqliteFilePath()

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
}

export async function syncAllSqlite(req, res) {
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
}

/**
 * Descarga el archivo SQLite exclusivo de una Ficha (enfoque híbrido: aprendices + datos del docente)
 */
export async function downloadSqliteFicha(req, res) {
  try {
    const { codigoFicha } = req.params
    if (!codigoFicha) {
      return res.status(400).json({ error: 'Código de ficha requerido' })
    }

    const ficha = await Ficha.findOne({ codigoFicha }).populate('instructorLiderId')
    if (!ficha) {
      return res.status(404).json({ error: 'Ficha no encontrada' })
    }

    const asistencias = await Asistencia.find({ fichaId: ficha._id })
      .populate('estudianteId')
      .populate('instructorId')
      .sort({ fecha: 1 })

    const rows = []
    for (const a of asistencias) {
      if (!a.estudianteId) continue
      const inst = a.instructorId || ficha.instructorLiderId
      rows.push({
        fichaCodigo: ficha.codigoFicha,
        nombrePrograma: ficha.nombrePrograma || '',
        jornada: ficha.jornada || '',
        documentoAprendiz: a.estudianteId.numeroDocumento || '',
        nombreAprendiz: `${a.estudianteId.nombres || ''} ${a.estudianteId.apellidos || ''}`.trim(),
        correoAprendiz: a.estudianteId.correo || '',
        fecha: a.fecha,
        estado: a.estado,
        hora: a.hora || '—',
        horasTardanza: a.horasTardanza || 0,
        tiempoTardanza: a.tiempoTardanza || '0 horas',
        instructorId: inst ? String(inst._id) : null,
        instructorNombre: inst ? `${inst.nombres || ''} ${inst.apellidos || ''}`.trim() : 'Sin asignar',
        instructorEspecialidad: inst?.especialidad || '',
      })
    }

    const { getDBFicha } = await import('../services/sqliteExport.js')
    const { db, filePath } = getDBFicha(ficha.codigoFicha)
    try {
      upsertAsistenciasBatchSQLite(rows, db)
    } finally {
      try { db.close() } catch (e) {}
    }

    res.setHeader('Content-Type', 'application/vnd.sqlite3')
    res.setHeader('Content-Disposition', `attachment; filename="asistencias_ficha_${ficha.codigoFicha}.sqlite"`)
    res.download(filePath, `asistencias_ficha_${ficha.codigoFicha}.sqlite`)
  } catch (err) {
    console.error('[SQLite] Error en descarga por ficha:', err)
    res.status(500).json({ error: err.message })
  }
}

/**
 * Ejecuta manualmente o bajo demanda la sincronización nocturna de todas las fichas
 */
export async function ejecutarSincronizacionFichas(req, res) {
  try {
    const { sincronizarSqlitePorFicha } = await import('../services/cronService.js')
    const resultado = await sincronizarSqlitePorFicha()
    res.json({ ok: true, mensaje: 'Sincronización híbrida por ficha ejecutada con éxito', ...resultado })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
