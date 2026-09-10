import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.resolve(__dirname, '../data')

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const dbPath = path.join(dataDir, 'asistencias_institucion.sqlite')
const fichasDir = path.join(dataDir, 'fichas')

if (!fs.existsSync(fichasDir)) {
  fs.mkdirSync(fichasDir, { recursive: true })
}

let db = null

function getDB() {
  if (!db) {
    db = new Database(dbPath)
    db.pragma('journal_mode = DELETE')
    initTables(db)
  }
  return db
}

export function initTables(sqliteInstance) {
  sqliteInstance.exec(`
    CREATE TABLE IF NOT EXISTS asistencias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ficha_codigo TEXT NOT NULL,
      nombre_programa TEXT,
      jornada TEXT,
      documento_aprendiz TEXT NOT NULL,
      nombre_aprendiz TEXT NOT NULL,
      correo_aprendiz TEXT,
      fecha TEXT NOT NULL,
      estado TEXT NOT NULL,
      hora TEXT,
      horas_tardanza INTEGER DEFAULT 0,
      tiempo_tardanza TEXT,
      instructor_id TEXT,
      instructor_nombre TEXT,
      instructor_especialidad TEXT,
      fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(ficha_codigo, documento_aprendiz, fecha)
    );
  `)

  // Migración segura para bases de datos SQLite preexistentes
  const columns = sqliteInstance.pragma('table_info(asistencias)').map(c => c.name)
  if (!columns.includes('instructor_id')) {
    sqliteInstance.exec(`ALTER TABLE asistencias ADD COLUMN instructor_id TEXT;`)
  }
  if (!columns.includes('instructor_nombre')) {
    sqliteInstance.exec(`ALTER TABLE asistencias ADD COLUMN instructor_nombre TEXT;`)
  }
  if (!columns.includes('instructor_especialidad')) {
    sqliteInstance.exec(`ALTER TABLE asistencias ADD COLUMN instructor_especialidad TEXT;`)
  }

  sqliteInstance.exec(`
    CREATE INDEX IF NOT EXISTS idx_asistencias_ficha_fecha ON asistencias (ficha_codigo, fecha);
    CREATE INDEX IF NOT EXISTS idx_asistencias_documento ON asistencias (documento_aprendiz);
    CREATE INDEX IF NOT EXISTS idx_asistencias_instructor ON asistencias (instructor_id);
  `)
}

/**
 * Retorna o crea la base de datos SQLite específica de una ficha
 */
export function getDBFicha(codigoFicha) {
  const safeCodigo = String(codigoFicha).replace(/[^a-zA-Z0-9_-]/g, '')
  const filePath = path.join(fichasDir, `asistencias_ficha_${safeCodigo}.sqlite`)
  const sqlite = new Database(filePath)
  sqlite.pragma('journal_mode = DELETE')
  initTables(sqlite)
  return { db: sqlite, filePath }
}

// Inicializar base global al cargar el módulo
try {
  getDB()
  console.log(`[SQLite] Base de datos relacional global lista en: ${dbPath}`)
} catch (err) {
  console.error('[SQLite] Error inicializando SQLite global:', err.message)
}

export function checkpointSQLite() {
  try {
    const sqlite = getDB()
    sqlite.pragma('wal_checkpoint(TRUNCATE)')
  } catch (e) {}
}

/**
 * Inserta o actualiza un registro individual de asistencia (UPSERT)
 * No incluye motivos privados de excusas, preservando la confidencialidad.
 */
export function upsertAsistenciaSQLite(item, targetDb = null) {
  try {
    const sqlite = targetDb || getDB()
    const stmt = sqlite.prepare(`
      INSERT INTO asistencias (
        ficha_codigo,
        nombre_programa,
        jornada,
        documento_aprendiz,
        nombre_aprendiz,
        correo_aprendiz,
        fecha,
        estado,
        hora,
        horas_tardanza,
        tiempo_tardanza,
        instructor_id,
        instructor_nombre,
        instructor_especialidad,
        fecha_actualizacion
      ) VALUES (
        @fichaCodigo,
        @nombrePrograma,
        @jornada,
        @documentoAprendiz,
        @nombreAprendiz,
        @correoAprendiz,
        @fecha,
        @estado,
        @hora,
        @horasTardanza,
        @tiempoTardanza,
        @instructorId,
        @instructorNombre,
        @instructorEspecialidad,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT(ficha_codigo, documento_aprendiz, fecha) DO UPDATE SET
        nombre_programa = excluded.nombre_programa,
        jornada = excluded.jornada,
        nombre_aprendiz = excluded.nombre_aprendiz,
        correo_aprendiz = excluded.correo_aprendiz,
        estado = excluded.estado,
        hora = excluded.hora,
        horas_tardanza = excluded.horas_tardanza,
        tiempo_tardanza = excluded.tiempo_tardanza,
        instructor_id = excluded.instructor_id,
        instructor_nombre = excluded.instructor_nombre,
        instructor_especialidad = excluded.instructor_especialidad,
        fecha_actualizacion = CURRENT_TIMESTAMP
    `)

    stmt.run({
      fichaCodigo: String(item.fichaCodigo || '').trim(),
      nombrePrograma: item.nombrePrograma || '',
      jornada: item.jornada || '',
      documentoAprendiz: String(item.documentoAprendiz || '').trim(),
      nombreAprendiz: item.nombreAprendiz || '',
      correoAprendiz: item.correoAprendiz || '',
      fecha: item.fecha,
      estado: item.estado,
      hora: item.hora || '—',
      horasTardanza: Number(item.horasTardanza) || 0,
      tiempoTardanza: item.tiempoTardanza || '0 horas',
      instructorId: item.instructorId ? String(item.instructorId) : null,
      instructorNombre: item.instructorNombre || null,
      instructorEspecialidad: item.instructorEspecialidad || null,
    })
    return { ok: true }
  } catch (err) {
    console.error('[SQLite] Error al guardar asistencia:', err.message)
    return { ok: false, error: err.message }
  }
}

/**
 * Inserta o actualiza un lote de asistencias en una sola transacción rápida
 */
export function upsertAsistenciasBatchSQLite(items, targetDb = null) {
  if (!items || items.length === 0) return { ok: true, count: 0 }
  try {
    const sqlite = targetDb || getDB()
    const stmt = sqlite.prepare(`
      INSERT INTO asistencias (
        ficha_codigo,
        nombre_programa,
        jornada,
        documento_aprendiz,
        nombre_aprendiz,
        correo_aprendiz,
        fecha,
        estado,
        hora,
        horas_tardanza,
        tiempo_tardanza,
        instructor_id,
        instructor_nombre,
        instructor_especialidad,
        fecha_actualizacion
      ) VALUES (
        @fichaCodigo,
        @nombrePrograma,
        @jornada,
        @documentoAprendiz,
        @nombreAprendiz,
        @correoAprendiz,
        @fecha,
        @estado,
        @hora,
        @horasTardanza,
        @tiempoTardanza,
        @instructorId,
        @instructorNombre,
        @instructorEspecialidad,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT(ficha_codigo, documento_aprendiz, fecha) DO UPDATE SET
        nombre_programa = excluded.nombre_programa,
        jornada = excluded.jornada,
        nombre_aprendiz = excluded.nombre_aprendiz,
        correo_aprendiz = excluded.correo_aprendiz,
        estado = excluded.estado,
        hora = excluded.hora,
        horas_tardanza = excluded.horas_tardanza,
        tiempo_tardanza = excluded.tiempo_tardanza,
        instructor_id = excluded.instructor_id,
        instructor_nombre = excluded.instructor_nombre,
        instructor_especialidad = excluded.instructor_especialidad,
        fecha_actualizacion = CURRENT_TIMESTAMP
    `)

    const insertMany = sqlite.transaction((rows) => {
      for (const item of rows) {
        stmt.run({
          fichaCodigo: String(item.fichaCodigo || '').trim(),
          nombrePrograma: item.nombrePrograma || '',
          jornada: item.jornada || '',
          documentoAprendiz: String(item.documentoAprendiz || '').trim(),
          nombreAprendiz: item.nombreAprendiz || '',
          correoAprendiz: item.correoAprendiz || '',
          fecha: item.fecha,
          estado: item.estado,
          hora: item.hora || '—',
          horasTardanza: Number(item.horasTardanza) || 0,
          tiempoTardanza: item.tiempoTardanza || '0 horas',
          instructorId: item.instructorId ? String(item.instructorId) : null,
          instructorNombre: item.instructorNombre || null,
          instructorEspecialidad: item.instructorEspecialidad || null,
        })
      }
    })

    insertMany(items)
    return { ok: true, count: items.length }
  } catch (err) {
    console.error('[SQLite] Error en lote:', err.message)
    return { ok: false, error: err.message }
  }
}

/**
 * Retorna la ruta física del archivo global .sqlite
 */
export function getSqliteFilePath() {
  return dbPath
}

/**
 * Retorna la ruta del directorio de fichas individuales
 */
export function getFichasDir() {
  return fichasDir
}
