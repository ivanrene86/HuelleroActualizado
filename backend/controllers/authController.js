import Admin from '../models/Admin.js'
import Instructor from '../models/Instructor.js'
import Estudiante from '../models/Estudiante.js'
import Ficha from '../models/Ficha.js'
import { generarToken } from '../middlewares/auth.js'
import { hashPassword, verifyAndUpgradePassword } from '../services/passwordService.js'

export async function login(req, res) {
  try {
    const { correo, password } = req.body
    if (!correo) {
      return res.status(400).json({ error: 'Correo o número de documento requerido' })
    }

    const identificador = String(correo).trim()

    // 1. Buscar en Administradores (por correo)
    const admin = await Admin.findOne({ correo: identificador })
    if (admin) {
      if (!password) {
        return res.status(400).json({ error: 'Contraseña requerida para cuenta de Administrador' })
      }
      const passOk = await verifyAndUpgradePassword(admin, password)
      if (passOk) {
        const payload = { id: admin._id, nombre: admin.nombre, correo: admin.correo, rol: admin.rol || 'Administrador' }
        const token = generarToken(payload)
        return res.json({
          ok: true,
          token,
          usuario: payload,
          admin: payload
        })
      }
      return res.status(401).json({ error: 'Contraseña incorrecta' })
    }

    // 2. Buscar en Instructores (por correo o número de documento)
    const instructor = await Instructor.findOne({
      $or: [{ correo: identificador }, { numeroDocumento: identificador }]
    })
    if (instructor) {
      if (instructor.estado === 'Inactivo') {
        return res.status(403).json({ error: 'Tu cuenta de instructor se encuentra inactiva' })
      }
      if (!password) {
        return res.status(400).json({ error: 'Contraseña requerida para cuenta de Instructor' })
      }
      const passOk = await verifyAndUpgradePassword(instructor, password)
      if (passOk) {
        const fichaLider = await Ficha.findOne({ instructorLiderId: instructor._id })
        const esLider = !!(instructor.esLider || fichaLider)
        const nombreCompleto = `${instructor.nombres} ${instructor.apellidos}`
        const payload = {
          id: instructor._id,
          nombre: nombreCompleto,
          correo: instructor.correo,
          rol: 'Instructor',
          esLider,
          rolDetallado: esLider ? 'Instructor Líder' : 'Instructor Común'
        }
        const token = generarToken(payload)
        return res.json({
          ok: true,
          token,
          usuario: payload,
          admin: payload
        })
      }
      return res.status(401).json({ error: 'Contraseña incorrecta' })
    }

    // 3. Buscar en Estudiantes / Aprendices (Consulta directa por documento o correo, sin requerir contraseña)
    const estudiante = await Estudiante.findOne({
      $or: [{ numeroDocumento: identificador }, { correo: identificador }]
    })
    if (estudiante) {
      if (estudiante.estado !== 'Activo') {
        return res.status(403).json({ error: `Tu cuenta de aprendiz se encuentra en estado ${estudiante.estado}` })
      }

      // Los aprendices acceden de forma directa por documento para consulta
      const nombreCompleto = `${estudiante.nombres} ${estudiante.apellidos}`
      const payload = {
        id: estudiante._id,
        nombre: nombreCompleto,
        correo: estudiante.correo,
        rol: 'Estudiante',
        estudianteId: estudiante._id
      }
      const token = generarToken(payload)
      return res.json({
        ok: true,
        token,
        usuario: payload,
        admin: payload
      })
    }

    return res.status(401).json({ error: 'Usuario no encontrado o credenciales incorrectas' })
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
      const passHash = password ? await hashPassword(password) : await hashPassword('sena2026ADSO')
      admin = new Admin({ nombre, telefono, correo, password: passHash })
    } else {
      if (nombre !== undefined) admin.nombre = nombre
      if (telefono !== undefined) admin.telefono = telefono
      if (correo !== undefined) admin.correo = correo
      if (password) {
        admin.password = await hashPassword(password)
      }
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

    if (nuevaPassword.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' })
    }

    const nuevaHash = await hashPassword(nuevaPassword)
    let encontrado = false

    const admin = await Admin.findOne({ correo })
    if (admin) {
      admin.password = nuevaHash
      await admin.save()
      encontrado = true
    }

    const instructor = await Instructor.findOne({ correo })
    if (instructor) {
      instructor.password = nuevaHash
      await instructor.save()
      encontrado = true
    }

    if (!encontrado) {
      return res.status(404).json({ error: 'No se encontró ninguna cuenta de docente o administrador con este correo' })
    }

    res.json({ ok: true, message: 'Contraseña restablecida exitosamente con cifrado seguro' })
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
    } else {
      if (id) {
        usuario = await Admin.findById(id) || await Instructor.findById(id)
      } else if (correo) {
        usuario = await Admin.findOne({ correo }) || await Instructor.findOne({ correo })
      }
    }

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado.' })
    }

    // 2. Verificar si la contraseña actual coincide mediante verifyAndUpgradePassword
    const passOk = await verifyAndUpgradePassword(usuario, passwordActual)
    if (!passOk) {
      return res.status(400).json({ error: 'La contraseña actual no coincide. Verifica e intenta de nuevo.' })
    }

    // 3. Hashear y guardar la nueva contraseña con bcrypt
    usuario.password = await hashPassword(nuevaPassword)
    await usuario.save()

    return res.json({ ok: true, message: '¡Contraseña actualizada exitosamente con cifrado seguro!' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
