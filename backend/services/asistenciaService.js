import mongoose from 'mongoose'
import Ficha from '../models/Ficha.js'

/**
 * Retorna la fecha actual local en formato YYYY-MM-DD
 */
export function getHoyString() {
  const ahora = new Date()
  const offsetMs = ahora.getTimezoneOffset() * 60000
  const localDate = new Date(ahora.getTime() - offsetMs)
  return localDate.toISOString().split('T')[0]
}

/**
 * Obtiene lista de ObjectIds compatibles buscando por _id o por codigoFicha
 */
export async function getFichaIdList(fichaId) {
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

/**
 * Calcula si una marcación corresponde a Tardanza o Presente según la jornada SENA
 */
export function calcularEstadoAsistencia(jornada, fechaHora = new Date()) {
  const horas = fechaHora.getHours()
  const minutos = fechaHora.getMinutes()
  const totalMinutos = horas * 60 + minutos

  // Tolerancia de 15 minutos en jornadas estándar SENA:
  // Mañana: 06:00 -> Límite 06:15 (375 min)
  // Tarde:  12:00 -> Límite 12:15 (735 min)
  // Noche:  18:00 -> Límite 18:15 (1095 min)
  let limiteMinutos = 375 // Mañana por defecto
  if (jornada === 'Tarde') limiteMinutos = 735
  if (jornada === 'Noche') limiteMinutos = 1095

  const esTardanza = totalMinutos > limiteMinutos
  return esTardanza ? 'Tardanza' : 'Presente'
}
