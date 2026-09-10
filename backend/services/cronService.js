import cron from 'node-cron'
import Ficha from '../models/Ficha.js'
import Asistencia from '../models/Asistencia.js'
import Instructor from '../models/Instructor.js'
import { getDBFicha, upsertAsistenciasBatchSQLite } from './sqliteExport.js'

/**
 * Servicio Cron Job para exportación / sincronización de listas a medianoche
 */
export function iniciarCronJobs() {
  const schedule = process.env.CRON_SCHEDULE || '0 0 * * *'
  const timezone = process.env.CRON_TIMEZONE || 'America/Bogota'

  cron.schedule(schedule, async () => {
    console.log(`\n[CRON] ⏰ ${new Date().toLocaleTimeString('es-CO')}: Iniciando sincronización nocturna de SQLite por Ficha...`)
    try {
      const resultado = await sincronizarSqlitePorFicha()
      console.log(`[CRON] ✅ Proceso finalizado exitosamente. Fichas procesadas: ${resultado.totalFichas}, Registros: ${resultado.totalRegistros}`)
    } catch (err) {
      console.error('[CRON] ❌ Error en la ejecución del Cron Job:', err.message)
    }
  }, {
    timezone
  })

  console.log(`[CRON] Programador nocturno listo (${schedule} - ${timezone})`)
}

/**
 * Genera y actualiza un archivo SQLite independiente para cada Ficha activa.
 * Cada fila contiene la información del aprendiz y el instructor asignado (enfoque híbrido).
 */
export async function sincronizarSqlitePorFicha() {
  const fichas = await Ficha.find().populate('instructorLiderId')
  let totalRegistros = 0
  let fichasActualizadas = 0

  for (const ficha of fichas) {
    if (!ficha.codigoFicha) continue

    // 1. Obtener todas las asistencias de esta ficha
    const asistencias = await Asistencia.find({ fichaId: ficha._id })
      .populate('estudianteId', 'nombres apellidos numeroDocumento tipoDocumento correo')
      .populate('instructorId', 'nombres apellidos especialidad')
      .sort({ fecha: 1 })

    if (!asistencias || asistencias.length === 0) continue

    // 2. Mapear datos con enfoque híbrido (aprendiz + ficha + profesor a cargo)
    const rows = []
    for (const a of asistencias) {
      if (!a.estudianteId) continue

      const inst = a.instructorId || ficha.instructorLiderId
      const nombreDocente = inst ? `${inst.nombres || ''} ${inst.apellidos || ''}`.trim() : 'Sin asignar'
      const especialidadDocente = inst?.especialidad || ''

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
        instructorNombre: nombreDocente,
        instructorEspecialidad: especialidadDocente,
      })
    }

    // 3. Abrir la base de datos SQLite exclusiva de esta ficha
    const { db, filePath } = getDBFicha(ficha.codigoFicha)
    try {
      const resBatch = upsertAsistenciasBatchSQLite(rows, db)
      totalRegistros += (resBatch.count || 0)
      fichasActualizadas++
      console.log(`[CRON] Ficha ${ficha.codigoFicha}: ${resBatch.count} asistencias sincronizadas en ${filePath}`)
    } finally {
      try { db.close() } catch (e) {}
    }
  }

  return {
    ok: true,
    totalFichas: fichasActualizadas,
    totalRegistros,
  }
}
