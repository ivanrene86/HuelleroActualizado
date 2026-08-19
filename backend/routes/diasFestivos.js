import { Router } from 'express'
import DiaFestivo from '../models/DiaFestivo.js'
import Ficha from '../models/Ficha.js'
import Estudiante from '../models/Estudiante.js'
import Asistencia from '../models/Asistencia.js'
import { upsertAsistenciasBatchSQLite } from '../services/sqliteExport.js'

const router = Router()

async function aplicarInhabilitacionDiaFestivo(diaDoc) {
  try {
    const { fecha, motivo, descripcion, fichasAplicables, fichasSeleccionadas, jornadasSeleccionadas } = diaDoc
    const motivoFinal = descripcion ? `${motivo} — ${descripcion}` : (motivo || 'Día inhabilitado / Festivo')

    let filtroFichas = {}
    if (fichasAplicables === 'jornada' && Array.isArray(jornadasSeleccionadas) && jornadasSeleccionadas.length > 0) {
      filtroFichas.jornada = { $in: jornadasSeleccionadas }
    } else if (fichasAplicables === 'especificas' && Array.isArray(fichasSeleccionadas) && fichasSeleccionadas.length > 0) {
      filtroFichas._id = { $in: fichasSeleccionadas }
    }

    const fichas = await Ficha.find(filtroFichas)
    if (fichas.length === 0) return

    const fichaIds = fichas.map(f => f._id)
    const estudiantes = await Estudiante.find({
      fichaId: { $in: fichaIds },
      estado: { $ne: 'Retirado' }
    })

    if (estudiantes.length === 0) return

    const fichaMap = new Map()
    fichas.forEach(f => fichaMap.set(String(f._id), f))

    const operaciones = estudiantes.map(est => {
      const fDoc = fichaMap.get(String(est.fichaId))
      return {
        updateOne: {
          filter: { estudianteId: est._id, fecha },
          update: {
            $set: {
              estudianteId: est._id,
              fichaId: fDoc?._id || est.fichaId,
              fecha,
              estado: 'Inhabilitada',
              hora: '—',
              horasTardanza: 0,
              tiempoTardanza: '0 horas',
              motivoInhabilitacion: motivoFinal,
            }
          },
          upsert: true
        }
      }
    })

    await Asistencia.bulkWrite(operaciones)

    const sqliteRows = estudiantes.map(est => {
      const fDoc = fichaMap.get(String(est.fichaId))
      return {
        fichaCodigo: fDoc?.codigoFicha || String(est.fichaId),
        nombrePrograma: fDoc?.nombrePrograma || '',
        jornada: fDoc?.jornada || '',
        documentoAprendiz: est.numeroDocumento || '',
        nombreAprendiz: `${est.nombres || ''} ${est.apellidos || ''}`.trim(),
        correoAprendiz: est.correo || '',
        fecha: fecha,
        estado: 'Inhabilitada',
        hora: '—',
        horasTardanza: 0,
        tiempoTardanza: '0 horas'
      }
    })
    upsertAsistenciasBatchSQLite(sqliteRows)
  } catch (err) {
    console.error('[DiaFestivo] Error aplicando inhabilitación automática:', err)
  }
}

async function revertirInhabilitacionDiaFestivo(diaDoc) {
  try {
    const { fecha, fichasAplicables, fichasSeleccionadas, jornadasSeleccionadas } = diaDoc
    let filtroFichas = {}
    if (fichasAplicables === 'jornada' && Array.isArray(jornadasSeleccionadas) && jornadasSeleccionadas.length > 0) {
      filtroFichas.jornada = { $in: jornadasSeleccionadas }
    } else if (fichasAplicables === 'especificas' && Array.isArray(fichasSeleccionadas) && fichasSeleccionadas.length > 0) {
      filtroFichas._id = { $in: fichasSeleccionadas }
    }
    const fichas = await Ficha.find(filtroFichas)
    const fichaIds = fichas.map(f => f._id)

    await Asistencia.deleteMany({
      fichaId: { $in: fichaIds },
      fecha,
      estado: 'Inhabilitada'
    })
  } catch (err) {
    console.error('[DiaFestivo] Error revirtiendo inhabilitación:', err)
  }
}

router.get('/', async (req, res) => {
  try {
    const dias = await DiaFestivo.find().populate('fichasSeleccionadas', 'codigoFicha nombrePrograma jornada').sort({ fecha: 1 })
    res.json(dias)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const dia = new DiaFestivo(req.body)
    await dia.save()
    await aplicarInhabilitacionDiaFestivo(dia)
    res.status(201).json(dia)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const dia = await DiaFestivo.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!dia) return res.status(404).json({ error: 'Dia festivo no encontrado' })
    await aplicarInhabilitacionDiaFestivo(dia)
    res.json(dia)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const dia = await DiaFestivo.findByIdAndDelete(req.params.id)
    if (!dia) return res.status(404).json({ error: 'Dia festivo no encontrado' })
    await revertirInhabilitacionDiaFestivo(dia)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
