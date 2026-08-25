/**
 * Middlewares de validación de datos de entrada
 */

export function validarCamposRequeridos(campos = []) {
  return (req, res, next) => {
    const faltantes = []
    for (const campo of campos) {
      if (req.body[campo] === undefined || req.body[campo] === null || req.body[campo] === '') {
        faltantes.push(campo)
      }
    }
    if (faltantes.length > 0) {
      return res.status(400).json({
        error: `Los siguientes campos son obligatorios: ${faltantes.join(', ')}`,
        camposFaltantes: faltantes,
      })
    }
    next()
  }
}

export function validarEmail(campo = 'correo') {
  return (req, res, next) => {
    const email = req.body[campo]
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: `El formato del correo electrónico (${campo}) es inválido` })
      }
    }
    next()
  }
}

export function validarFecha(campo = 'fecha') {
  return (req, res, next) => {
    const fecha = req.body[campo] || req.query[campo]
    if (fecha) {
      const fechaRegex = /^\d{4}-\d{2}-\d{2}$/
      if (!fechaRegex.test(fecha) || isNaN(Date.parse(fecha))) {
        return res.status(400).json({ error: `El campo ${campo} debe tener el formato YYYY-MM-DD válido` })
      }
    }
    next()
  }
}
