import Admin from '../models/Admin.js'
import Instructor from '../models/Instructor.js'
import Estudiante from '../models/Estudiante.js'
import Ficha from '../models/Ficha.js'

export async function login(req, res) {
  try {
    const { correo, password } = req.body
    if (!correo || !password) {
      return res.status(400).json({ error: 'Correo y contraseña requeridos' })
    }

    // 1. Buscar en Administradores
    const admin = await Admin.findOne({ correo, password })
    if (admin) {
      return res.json({
        ok: true,
        usuario: { id: admin._id, nombre: admin.nombre, correo: admin.correo, rol: admin.rol || 'Administrador' },
        admin: { id: admin._id, nombre: admin.nombre, correo: admin.correo, rol: admin.rol || 'Administrador' }
      })
    }

    // 2. Buscar en Instructores
    const instructor = await Instructor.findOne({ correo, password })
    if (instructor) {
      if (instructor.estado === 'Inactivo') {
        return res.status(403).json({ error: 'Tu cuenta de instructor se encuentra inactiva' })
      }
      const fichaLider = await Ficha.findOne({ instructorLiderId: instructor._id })
      const esLider = !!(instructor.esLider || fichaLider)
      const nombreCompleto = `${instructor.nombres} ${instructor.apellidos}`
      return res.json({
        ok: true,
        usuario: { id: instructor._id, nombre: nombreCompleto, correo: instructor.correo, rol: 'Instructor', esLider, rolDetallado: esLider ? 'Instructor Líder' : 'Instructor Común' },
        admin: { id: instructor._id, nombre: nombreCompleto, correo: instructor.correo, rol: 'Instructor', esLider, rolDetallado: esLider ? 'Instructor Líder' : 'Instructor Común' }
      })
    }

    // 3. Buscar en Estudiantes (por correo o número de documento)
    const estudiante = await Estudiante.findOne({
      $or: [{ correo }, { numeroDocumento: correo }]
    })
    if (estudiante) {
      if (estudiante.estado !== 'Activo') {
        return res.status(403).json({ error: `Tu cuenta de estudiante se encuentra en estado ${estudiante.estado}` })
      }
      // Contraseña del estudiante: su número de documento o clave por defecto
      const passCorrecta = password === estudiante.numeroDocumento || password === 'sena2026'
      if (passCorrecta) {
        const nombreCompleto = `${estudiante.nombres} ${estudiante.apellidos}`
        return res.json({
          ok: true,
          usuario: { id: estudiante._id, nombre: nombreCompleto, correo: estudiante.correo, rol: 'Estudiante', estudianteId: estudiante._id },
          admin: { id: estudiante._id, nombre: nombreCompleto, correo: estudiante.correo, rol: 'Estudiante', estudianteId: estudiante._id }
        })
      }
    }

    return res.status(401).json({ error: 'Correo/Documento o contraseña incorrectos' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function getPerfil(req, res) {
  try {
    const admin = await Admin.findOne()
    if (!admin) return res.json(null)
    res.json({ nombre: admin.nombre, rol: admin.rol, telefono: admin.telefono, correo: admin.correo })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function updatePerfil(req, res) {
  try {
    const { nombre, telefono, correo, password } = req.body
    let admin = await Admin.findOne()
    if (!admin) {
      admin = new Admin({ nombre, telefono, correo, password: password || 'sena2026ADSO' })
    } else {
      if (nombre !== undefined) admin.nombre = nombre
      if (telefono !== undefined) admin.telefono = telefono
      if (correo !== undefined) admin.correo = correo
      if (password) admin.password = password
    }
    await admin.save()
    res.json({ ok: true, perfil: { nombre: admin.nombre, rol: admin.rol, telefono: admin.telefono, correo: admin.correo } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function recoveryCode(req, res) {
  try {
    const { correo } = req.body
    const admin = await Admin.findOne({ correo })
    const instructor = await Instructor.findOne({ correo })
    const estudiante = await Estudiante.findOne({ correo })

    if (!admin && !instructor && !estudiante) {
      return res.status(404).json({ error: 'No existe una cuenta asociada a este correo electrónico' })
    }

    const codigo = String(Math.floor(100000 + Math.random() * 900000))
    res.json({ ok: true, codigo, expira: Date.now() + 10 * 60 * 1000 })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function resetPassword(req, res) {
  try {
    const { correo, nuevaPassword } = req.body
    if (!correo || !nuevaPassword) {
      return res.status(400).json({ error: 'Correo y nueva contraseña requeridos' })
    }

    let encontrado = false

    const admin = await Admin.findOne({ correo })
    if (admin) {
      admin.password = nuevaPassword
      await admin.save()
      encontrado = true
    }

    const instructor = await Instructor.findOne({ correo })
    if (instructor) {
      instructor.password = nuevaPassword
      await instructor.save()
      encontrado = true
    }

    const estudiante = await Estudiante.findOne({ correo })
    if (estudiante) {
      estudiante.password = nuevaPassword
      await estudiante.save()
      encontrado = true
    }

    if (!encontrado) {
      return res.status(404).json({ error: 'No se encontró ninguna cuenta con este correo' })
    }

    res.json({ ok: true, message: 'Contraseña restablecida exitosamente' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export async function cambiarPassword(req, res) {
  try {
    const { id, rol, correo, passwordActual, nuevaPassword } = req.body
    if (!passwordActual || !nuevaPassword) {
      return res.status(400).json({ error: 'Debes ingresar tu contraseña actual y la nueva contraseña.' })
    }

    if (nuevaPassword.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' })
    }

    let usuario = null
    const rolNormalizado = (rol || '').toLowerCase()

    // 1. Buscar según rol o id/correo
    if (rolNormalizado.includes('admin') || (!rol && !id)) {
      if (id) usuario = await Admin.findById(id)
      if (!usuario && correo) usuario = await Admin.findOne({ correo })
      if (!usuario) usuario = await Admin.findOne()
    } else if (rolNormalizado.includes('instructor')) {
      if (id) usuario = await Instructor.findById(id)
      if (!usuario && correo) usuario = await Instructor.findOne({ correo })
    } else if (rolNormalizado.includes('estudiante')) {
      if (id) usuario = await Estudiante.findById(id)
      if (!usuario && correo) usuario = await Estudiante.findOne({ $or: [{ correo }, { numeroDocumento: correo }] })
    } else {
      // Búsqueda en cascada
      if (id) {
        usuario = await Admin.findById(id) || await Instructor.findById(id) || await Estudiante.findById(id)
      } else if (correo) {
        usuario = await Admin.findOne({ correo }) || await Instructor.findOne({ correo }) || await Estudiante.findOne({ correo })
      }
    }

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado.' })
    }

    // 2. Verificar si la contraseña actual coincide
    const passwordActualValida = (usuario.password || 'sena2026') === passwordActual ||
      (usuario.numeroDocumento && usuario.numeroDocumento === passwordActual)

    if (!passwordActualValida) {
      return res.status(400).json({ error: 'La contraseña actual no coincide. Verifica e intenta de nuevo.' })
    }

    // 3. Asignar y guardar la nueva contraseña
    usuario.password = nuevaPassword
    await usuario.save()

    return res.json({ ok: true, message: '¡Contraseña actualizada exitosamente!' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
