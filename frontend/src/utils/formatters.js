/**
 * Formateadores de fecha, hora y texto para la interfaz
 */

export function formatearFecha(fechaStr) {
  if (!fechaStr) return '—'
  const partes = String(fechaStr).split('-')
  if (partes.length === 3) {
    const [anio, mes, dia] = partes
    return `${dia}/${mes}/${anio}`
  }
  return fechaStr
}

export function formatearHora12(horaStr) {
  if (!horaStr || horaStr === '—') return '—'
  return horaStr
}

export function getIniciales(nombres = '', apellidos = '') {
  const n = String(nombres).trim().charAt(0) || 'A'
  const a = String(apellidos).trim().charAt(0) || ''
  return (n + a).toUpperCase()
}

export function getBadgeClase(estado) {
  const est = String(estado).toLowerCase()
  if (est === 'presente') return 'badge-success'
  if (est === 'tardanza') return 'badge-warning'
  if (est === 'excusada') return 'badge-info'
  if (est === 'inhabilitada') return 'badge-orange'
  return 'badge-danger'
}
