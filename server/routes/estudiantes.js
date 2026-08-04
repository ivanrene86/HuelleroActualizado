import { Router } from 'express'
import Estudiante from '../models/Estudiante.js'
import * as fp from '../services/fingerprint.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const { fichaId, documento, nombres, estado } = req.query
    const filter = {}
    if (fichaId) filter.fichaId = fichaId
    if (estado) filter.estado = estado
    if (documento) filter.numeroDocumento = { $regex: documento, $options: 'i' }
    if (nombres) {
      filter.$or = [
        { nombres: { $regex: nombres, $options: 'i' } },
        { apellidos: { $regex: nombres, $options: 'i' } },
      ]
    }
    const estudiantes = await Estudiante.find(filter).sort({ createdAt: -1 })
    res.json(estudiantes)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const estudiante = new Estudiante(req.body)
    await estudiante.save()
    res.status(201).json(estudiante)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// =============================================
// ENROLAMIENTO DE HUELLA CON LECTOR U.are.U 4500
// =============================================

router.post('/enroll-start', async (req, res) => {
  if (!fp.isAvailable()) {
    return res.status(500).json({ success: false, error: 'SDK de huella no disponible. Instale el U.are.U SDK.' })
  }
  const { studentId, name, documento } = req.body
  if (!studentId || !name) {
    return res.status(400).json({ success: false, error: 'studentId y name son requeridos' })
  }
  const { dedo } = req.body
  try {
    const estudiante = await Estudiante.findById(studentId)
    if (!estudiante) {
      return res.status(404).json({ success: false, error: 'Estudiante no encontrado' })
    }
    const session = fp.startSession(studentId, name, documento, dedo || '')
    res.json({ success: true, ...session })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/enroll-capture', (req, res) => {
  if (!fp.isAvailable()) {
    return res.status(500).json({ success: false, error: 'SDK de huella no disponible' })
  }
  const { sessionId, image } = req.body
  if (!sessionId || !image) {
    return res.status(400).json({ success: false, error: 'sessionId e image (PNG base64) son requeridos' })
  }
  const imageBase64 = image.replace(/^data:image\/png;base64,/, '')
  const result = fp.addCapture(sessionId, imageBase64)
  if (result.error) {
    return res.status(400).json({ success: false, error: result.error })
  }
  res.json({ success: true, ...result })
})

router.post('/enroll-complete', async (req, res) => {
  if (!fp.isAvailable()) {
    return res.status(500).json({ success: false, error: 'SDK de huella no disponible' })
  }
  const { sessionId } = req.body
  if (!sessionId) {
    return res.status(400).json({ success: false, error: 'sessionId es requerido' })
  }
  const result = fp.completeEnrollment(sessionId)
  if (result.error) {
    return res.status(500).json({ success: false, error: result.error })
  }
  try {
    const estudiante = await Estudiante.findByIdAndUpdate(
      result.studentId,
      {
        huellaEnrolada: true,
        huellaTemplate: result.template,
        fechaEnrolamiento: new Date().toISOString().split('T')[0],
        dedoEnrolado: result.dedo || '',
      },
      { new: true }
    )
    if (!estudiante) {
      return res.status(404).json({ success: false, error: 'Estudiante no encontrado' })
    }
    res.json({
      success: true,
      studentId: result.studentId,
      name: result.name,
      message: `Huella registrada exitosamente para "${result.name}"`,
    })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al guardar: ' + err.message })
  }
})

router.post('/enroll-cancel', (req, res) => {
  const { sessionId } = req.body
  const result = fp.cancelSession(sessionId)
  res.json({ success: true, ...result })
})

router.post('/verify', async (req, res) => {
  if (!fp.isAvailable()) {
    return res.status(500).json({ success: false, error: 'SDK de huella no disponible' })
  }
  const { image, fichaId } = req.body
  if (!image) {
    return res.status(400).json({ success: false, error: 'image (PNG base64) es requerido' })
  }

  const imageBase64 = image.replace(/^data:image\/png;base64,/, '')

  try {
    const filter = { huellaEnrolada: true, huellaTemplate: { $ne: '' } }
    if (fichaId) filter.fichaId = fichaId
    const enrolledStudents = await Estudiante.find(filter)
    const result = fp.verifyFingerprint(imageBase64, enrolledStudents)
    res.json({ success: true, ...result })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/fingerprint-status', (req, res) => {
  res.json({ sdkAvailable: fp.isAvailable() })
})

// Endpoint legacy (compatibilidad)
router.put('/:id/enrolar-huella', async (req, res) => {
  try {
    const { huellaTemplate } = req.body
    const estudiante = await Estudiante.findByIdAndUpdate(
      req.params.id,
      {
        huellaEnrolada: true,
        huellaTemplate: huellaTemplate || `TEMPLATE_HUELLA_${Date.now()}`,
        fechaEnrolamiento: new Date().toISOString().split('T')[0]
      },
      { new: true }
    )
    if (!estudiante) return res.status(404).json({ error: 'Estudiante no encontrado' })
    res.json({ ok: true, estudiante })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const estudiante = await Estudiante.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!estudiante) return res.status(404).json({ error: 'Estudiante no encontrado' })
    res.json(estudiante)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const estudiante = await Estudiante.findByIdAndDelete(req.params.id)
    if (!estudiante) return res.status(404).json({ error: 'Estudiante no encontrado' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/importar', async (req, res) => {
  try {
    const { estudiantes } = req.body
    if (!estudiantes || !Array.isArray(estudiantes)) {
      return res.status(400).json({ error: 'Se requiere un array de estudiantes' })
    }
    const result = await Estudiante.insertMany(estudiantes)
    res.status(201).json({ ok: true, count: result.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
