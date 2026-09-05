import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
})

/**
 * Notifica al instructor por correo electrónico cuando un aprendiz radica una nueva excusa.
 */
export async function notificarExcusaAInstructor({ instructorCorreo, instructorNombre, aprendizNombre, documentoAprendiz, fichaCodigo, fechaInasistencia, motivo, horasDescontar }) {
  if (!instructorCorreo || !process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    return false
  }

  try {
    await transporter.sendMail({
      from: `"Sistema Huellero SENA" <${process.env.GMAIL_USER}>`,
      to: instructorCorreo,
      subject: `[Nueva Excusa Radicada] Aprendiz: ${aprendizNombre} - Ficha ${fichaCodigo}`,
      text: `Estimado(a) ${instructorNombre || 'Instructor'},\n\nEl aprendiz ${aprendizNombre} (Doc: ${documentoAprendiz}) de la ficha ${fichaCodigo} ha radicado una excusa para la fecha ${fechaInasistencia}.\n\nMotivo: ${motivo}\nHoras asociadas: ${horasDescontar || 6} horas.\n\nPuede revisar, aprobar o rechazar esta excusa en el sistema en la sección 'Gestión de Excusas'.`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;">
          <div style="text-align:center;padding-bottom:16px;border-bottom:2px solid #16a34a;">
            <h2 style="color:#16a34a;margin:0;font-size:20px;">SENA - Notificación de Excusa</h2>
            <p style="color:#64748b;margin:4px 0 0;font-size:13px;">Sistema de Control Biométrico y Asistencia</p>
          </div>
          <div style="padding:20px 0;">
            <p style="color:#1e293b;font-size:15px;">Hola <strong>${instructorNombre || 'Instructor(a)'}</strong>,</p>
            <p style="color:#475569;font-size:14px;line-height:1.5;">
              Se ha radicado una nueva justificación de inasistencia que requiere su revisión:
            </p>
            <div style="background:#f8fafc;border-left:4px solid #16a34a;border-radius:6px;padding:16px;margin:16px 0;">
              <p style="margin:4px 0;font-size:14px;color:#334155;"><strong>Aprendiz:</strong> ${aprendizNombre} (${documentoAprendiz})</p>
              <p style="margin:4px 0;font-size:14px;color:#334155;"><strong>Ficha:</strong> ${fichaCodigo}</p>
              <p style="margin:4px 0;font-size:14px;color:#334155;"><strong>Fecha inasistencia:</strong> ${fechaInasistencia}</p>
              <p style="margin:4px 0;font-size:14px;color:#334155;"><strong>Horas a justificar:</strong> ${horasDescontar || 6} horas</p>
              <p style="margin:4px 0;font-size:14px;color:#334155;"><strong>Motivo:</strong> ${motivo}</p>
            </div>
            <p style="color:#64748b;font-size:13px;">
              Ingrese al sistema en el menú <strong>Gestión de Excusas</strong> para validar el soporte y aprobar o rechazar la solicitud.
            </p>
          </div>
          <div style="text-align:center;border-top:1px solid #e2e8f0;padding-top:14px;">
            <span style="color:#94a3b8;font-size:12px;">Mensaje automático generado por el Sistema de Asistencia Huellero SENA.</span>
          </div>
        </div>
      `,
    })
    console.log(`[Email] Notificación de excusa enviada a ${instructorCorreo}`)
    return true
  } catch (err) {
    console.warn(`[Email] No se pudo enviar notificación de excusa a ${instructorCorreo}:`, err.message)
    return false
  }
}
