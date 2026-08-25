/**
 * Middlewares de Autenticación y Autorización por Roles
 */

export function verificarRol(rolesPermitidos = []) {
  return (req, res, next) => {
    // Si no se especifican roles, permitir todo
    if (!rolesPermitidos || rolesPermitidos.length === 0) {
      return next()
    }

    const rolUsuario = req.headers['x-user-rol'] || req.body?.userRol

    if (!rolUsuario) {
      // Por compatibilidad si no se envía header, pasar
      return next()
    }

    if (!rolesPermitidos.includes(rolUsuario)) {
      return res.status(403).json({
        error: `Acceso no autorizado. Se requiere uno de los siguientes roles: ${rolesPermitidos.join(', ')}`,
      })
    }

    next()
  }
}
