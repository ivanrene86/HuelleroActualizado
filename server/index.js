import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import nodemailer from 'nodemailer'
import Admin from './models/Admin.js'
import authRoutes from './routes/auth.js'
import instructoresRoutes from './routes/instructores.js'
import fichasRoutes from './routes/fichas.js'
import estudiantesRoutes from './routes/estudiantes.js'
import asistenciasRoutes from './routes/asistencias.js'
import diasFestivosRoutes from './routes/diasFestivos.js'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json({ limit: '10mb' }))

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
})

transporter.verify()
  .then(() => console.log('SMTP listo'))
  .catch((err) => console.error('Error SMTP:', err.message))

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('MongoDB conectado')

    const existeAdmin = await Admin.findOne({ correo: 'senahuellero@gmail.com' })
    if (!existeAdmin) {
      await new Admin({
        nombre: 'Administrador',
        rol: 'Administrador',
        telefono: '',
        correo: 'senahuellero@gmail.com',
        password: 'sena2026ADSO',
      }).save()
      console.log('Admin por defecto creado')
    }

    app.listen(PORT, () => {
      console.log(`Backend en http://localhost:${PORT}`)
    })
  })
  .catch((err) => {
    console.error('Error MongoDB:', err.message)
    process.exit(1)
  })

app.post('/api/enviar-codigo', async (req, res) => {
  const { correo, codigo } = req.body
  if (!correo || !codigo) {
    return res.status(400).json({ error: 'Correo y codigo son requeridos' })
  }
  try {
    await transporter.sendMail({
      from: `"Admin Panel SENA" <${process.env.GMAIL_USER}>`,
      to: correo,
      subject: 'Codigo de recuperacion - Admin Panel',
      text: `Tu codigo de verificacion es: ${codigo}\n\nEste codigo expira en 10 minutos.`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px"><h2 style="color:#1e293b">Codigo de Recuperacion</h2><p style="color:#64748b">Usa el siguiente codigo para restablecer tu contrasena:</p><div style="background:#f1f5f9;border-radius:8px;padding:20px;text-align:center;margin:24px 0"><span style="font-family:monospace;font-size:36px;font-weight:700;letter-spacing:8px;color:#1e293b">${codigo}</span></div><p style="color:#94a3b8;font-size:13px">Este codigo expira en 10 minutos.</p></div>`,
    })
    res.json({ ok: true, message: 'Codigo enviado correctamente' })
  } catch (error) {
    console.error('Error al enviar correo:', error.message)
    res.status(500).json({ error: 'Error al enviar el correo' })
  }
})

app.use('/api/auth', authRoutes)
app.use('/api/instructores', instructoresRoutes)
app.use('/api/fichas', fichasRoutes)
app.use('/api/estudiantes', estudiantesRoutes)
app.use('/api/asistencias', asistenciasRoutes)
app.use('/api/dias-festivos', diasFestivosRoutes)
