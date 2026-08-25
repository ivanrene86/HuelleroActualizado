/**
 * Utilidades de validación de formularios para el Frontend
 */

export function esEmailValido(email) {
  if (!email || typeof email !== 'string') return false
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return regex.test(email.trim())
}

export function esDocumentoValido(doc) {
  if (!doc) return false
  const str = String(doc).trim()
  return str.length >= 5 && str.length <= 15
}

export function esPasswordSegura(password) {
  if (!password || typeof password !== 'string') return false
  return password.length >= 6
}
