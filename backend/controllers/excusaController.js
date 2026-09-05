import Excusa from '../models/Excusa.js'
import Asistencia from '../models/Asistencia.js'
import Estudiante from '../models/Estudiante.js'
import Ficha from '../models/Ficha.js'
import Instructor from '../models/Instructor.js'
import { upsertAsistenciaSQLite } from '../services/sqliteExport.js'
import { notificarExcusaAInstructor } from '../services/emailService.js'

export async function getExcusas(req, res) {
  try {
    const { estado, fichaId, estudianteId } = req.query
    const filter = {}
    if (estado) filter.estado = estado
    if (fichaId) filter.fichaId = fichaId
    if (estudianteId) filter.estudianteId = estudianteId

    const excusas = await Excusa.find(filter)
      .populate('estudianteId', 'nombres apellidos numeroDocumento tipoDocumento correo')
      .populate('fichaId', 'codigoFicha nombrePrograma jornada aulaAsignada')
      .populate('instructorId', 'nombres apellidos especialidad correo')
      .sort({ createdAt: -1 })

    res.json(excusas)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function createExcusa(req, res) {
  try {
    const data = { ...req.body }

    // Si no se proporcionó instructorId, buscarlo automáticamente en el registro de asistencia de esa fecha
    if (!data.instructorId && data.estudianteId && data.fechaInasistencia) {
      const regAsistencia = await Asistencia.findOne({
        estudianteId: data.estudianteId,
        fecha: data.fechaInasistencia
      })
      if (regAsistencia?.instructorId) {
        data.instructorId = regAsistencia.instructorId
      }
    }

    // Si no se especificaron horas a descontar, calcular por jornada de la ficha
    if (!data.horasDescontar && data.fichaId) {
      const fichaDoc = await Ficha.findById(data.fichaId)
      const j = (fichaDoc?.jornada || '').toLowerCase()
      data.horasDescontar = (j.includes('noche') || j.includes('nocturna')) ? 4 : 6
    }

    const excusa = new Excusa(data)
    await excusa.save()

    const excusaPopulada = await Excusa.findById(excusa._id)
      .populate('estudianteId', 'nombres apellidos numeroDocumento tipoDocumento correo')
      .populate('fichaId', 'codigoFicha nombrePrograma jornada aulaAsignada')
      .populate('instructorId', 'nombres apellidos especialidad correo')

    // Notificar al instructor por correo si está asignado
    if (excusaPopulada?.instructorId?.correo) {
      notificarExcusaAInstructor({
        instructorCorreo: excusaPopulada.instructorId.correo,
        instructorNombre: `${excusaPopulada.instructorId.nombres || ''} ${excusaPopulada.instructorId.apellidos || ''}`.trim(),
        aprendizNombre: `${excusaPopulada.estudianteId?.nombres || ''} ${excusaPopulada.estudianteId?.apellidos || ''}`.trim(),
        documentoAprendiz: excusaPopulada.estudianteId?.numeroDocumento || '—',
        fichaCodigo: excusaPopulada.fichaId?.codigoFicha || '—',
        fechaInasistencia: excusaPopulada.fechaInasistencia,
        motivo: excusaPopulada.motivo,
        horasDescontar: excusaPopulada.horasDescontar || 6,
      }).catch(err => console.warn('[Excusa] Error al disparar email de notificación:', err.message))
    }

    res.status(201).json(excusaPopulada)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function updateExcusa(req, res) {
  try {
    const excusa = await Excusa.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('estudianteId', 'nombres apellidos numeroDocumento tipoDocumento correo')
      .populate('fichaId', 'codigoFicha nombrePrograma jornada aulaAsignada')
      .populate('instructorId', 'nombres apellidos especialidad correo')

    if (!excusa) return res.status(404).json({ error: 'Excusa no encontrada' })
    res.json(excusa)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function aprobarExcusa(req, res) {
  try {
    const excusa = await Excusa.findById(req.params.id)
    if (!excusa) return res.status(404).json({ error: 'Excusa no encontrada' })

    excusa.estado = 'Aprobada'
    await excusa.save()

    let asistencia = await Asistencia.findOne({
      estudianteId: excusa.estudianteId,
      fecha: excusa.fechaInasistencia,
      fichaId: excusa.fichaId,
    })

    if (asistencia) {
      asistencia.estado = 'Excusada'
      asistencia.motivoInhabilitacion = excusa.motivo || 'Falta justificada con excusa'
      await asistencia.save()
    } else {
      asistencia = new Asistencia({
        estudianteId: excusa.estudianteId,
        fichaId: excusa.fichaId,
        fecha: excusa.fechaInasistencia,
        estado: 'Excusada',
        hora: '—',
        instructorId: excusa.instructorId || null,
        motivoInhabilitacion: excusa.motivo || 'Falta justificada con excusa'
      })
      await asistencia.save()
    }

    await Estudiante.findByIdAndUpdate(excusa.estudianteId, { estadoAsistencia: 'Excusada' })

    // Sincronizar actualización en SQLite
    try {
      const [estudianteDoc, fichaDoc] = await Promise.all([
        Estudiante.findById(excusa.estudianteId),
        Ficha.findById(excusa.fichaId)
      ])

      if (estudianteDoc && fichaDoc) {
        upsertAsistenciaSQLite({
          fichaCodigo: fichaDoc.codigoFicha || String(excusa.fichaId),
          nombrePrograma: fichaDoc.nombrePrograma || '',
          jornada: fichaDoc.jornada || '',
          documentoAprendiz: estudianteDoc.numeroDocumento || '',
          nombreAprendiz: `${estudianteDoc.nombres || ''} ${estudianteDoc.apellidos || ''}`.trim(),
          correoAprendiz: estudianteDoc.correo || '',
          fecha: excusa.fechaInasistencia,
          estado: 'Excusada',
          hora: asistencia?.hora || '—',
          horasTardanza: 0,
          tiempoTardanza: '0 horas'
        })
      }
    } catch (sqliteErr) {
      console.warn('[SQLite] Error al actualizar excusa en SQLite:', sqliteErr.message)
    }

    res.json({ ok: true, excusa })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function rechazarExcusa(req, res) {
  try {
    const { motivoRechazo } = req.body
    const excusa = await Excusa.findByIdAndUpdate(
      req.params.id,
      { estado: 'Rechazada', motivoRechazo: motivoRechazo || '' },
      { new: true }
    )
      .populate('estudianteId', 'nombres apellidos numeroDocumento tipoDocumento correo')
      .populate('fichaId', 'codigoFicha nombrePrograma jornada aulaAsignada')
      .populate('instructorId', 'nombres apellidos especialidad correo')

    if (!excusa) return res.status(404).json({ error: 'Excusa no encontrada' })
    res.json({ ok: true, excusa })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
