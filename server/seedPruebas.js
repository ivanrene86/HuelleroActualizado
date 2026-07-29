import 'dotenv/config'
import mongoose from 'mongoose'
import Admin from './models/Admin.js'
import Instructor from './models/Instructor.js'
import Ficha from './models/Ficha.js'
import Estudiante from './models/Estudiante.js'

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('Conectado a MongoDB Atlas para cargar datos de prueba...')

    // 1. Crear Admin si no existe
    let admin = await Admin.findOne({ correo: 'senahuellero@gmail.com' })
    if (!admin) {
      admin = await new Admin({
        nombre: 'Administrador Principal',
        rol: 'Administrador',
        telefono: '3000000000',
        correo: 'senahuellero@gmail.com',
        password: 'sena2026ADSO',
      }).save()
      console.log('✅ Admin creado: senahuellero@gmail.com')
    }

    // 2. Crear Instructor 1 (Carlos Mendoza)
    let instructor1 = await Instructor.findOne({ correo: 'carlos.mendoza@sena.edu.co' })
    if (!instructor1) {
      instructor1 = await new Instructor({
        nombres: 'Carlos',
        apellidos: 'Mendoza',
        tipoDocumento: 'CC',
        numeroDocumento: '1098765432',
        correo: 'carlos.mendoza@sena.edu.co',
        telefono: '3001234567',
        especialidad: 'Desarrollo de Software',
        password: 'sena2026',
        rol: 'Instructor',
        estado: 'Activo',
      }).save()
      console.log('✅ Instructor 1 creado: carlos.mendoza@sena.edu.co')
    }

    // 3. Crear Instructor 2 (María Rodríguez)
    let instructor2 = await Instructor.findOne({ correo: 'maria.rodriguez@sena.edu.co' })
    if (!instructor2) {
      instructor2 = await new Instructor({
        nombres: 'María',
        apellidos: 'Rodríguez',
        tipoDocumento: 'CC',
        numeroDocumento: '1098765433',
        correo: 'maria.rodriguez@sena.edu.co',
        telefono: '3009876543',
        especialidad: 'Ciberseguridad y Redes',
        password: 'sena2026',
        rol: 'Instructor',
        estado: 'Activo',
      }).save()
      console.log('✅ Instructor 2 creado: maria.rodriguez@sena.edu.co')
    }

    // 4. Crear o Actualizar Ficha 1 (2670123 - ADSO): Carlos es Líder, María es Común
    let ficha1 = await Ficha.findOne({ codigoFicha: '2670123' })
    if (!ficha1) {
      ficha1 = await new Ficha({
        codigoFicha: '2670123',
        nombrePrograma: 'Análisis y Desarrollo de Software (ADSO)',
        jornada: 'Diurna',
        aulaAsignada: 'Aula 302 - Bloque A',
        instructorLiderId: instructor1._id,
        instructores: [instructor2._id],
        fechaInicio: '2026-02-01',
        fechaFin: '2026-11-30',
      }).save()
      console.log('✅ Ficha ADSO (2670123) creada: Carlos es Líder, María es Común')
    } else {
      ficha1.instructorLiderId = instructor1._id
      ficha1.instructores = [instructor2._id]
      await ficha1.save()
      console.log('✅ Ficha ADSO (2670123) actualizada')
    }

    // 5. Crear o Actualizar Ficha 2 (2891234 - Ciberseguridad): María es Líder, Carlos es Común
    let ficha2 = await Ficha.findOne({ codigoFicha: '2891234' })
    if (!ficha2) {
      ficha2 = await new Ficha({
        codigoFicha: '2891234',
        nombrePrograma: 'Gestión de Redes y Ciberseguridad',
        jornada: 'Nocturna',
        aulaAsignada: 'Laboratorio 105 - Bloque C',
        instructorLiderId: instructor2._id,
        instructores: [instructor1._id],
        fechaInicio: '2026-02-01',
        fechaFin: '2026-11-30',
      }).save()
      console.log('✅ Ficha Ciberseguridad (2891234) creada: María es Líder, Carlos es Común')
    } else {
      ficha2.instructorLiderId = instructor2._id
      ficha2.instructores = [instructor1._id]
      await ficha2.save()
      console.log('✅ Ficha Ciberseguridad (2891234) actualizada')
    }

    // 6. Aprendices de prueba
    const estudiantesData = [
      {
        nombres: 'Juan',
        apellidos: 'Pérez',
        tipoDocumento: 'CC',
        numeroDocumento: '1012345678',
        correo: 'juan.perez@misena.edu.co',
        telefono: '3101112233',
        fichaId: ficha1._id,
        genero: 'Masculino',
        estado: 'Activo',
        huellaEnrolada: true,
        huellaTemplate: 'TEMPLATE_BIOMETRICO_JUAN_PEREZ_001',
        fechaEnrolamiento: '2026-02-10'
      },
      {
        nombres: 'Ana',
        apellidos: 'Gómez',
        tipoDocumento: 'CC',
        numeroDocumento: '1087654321',
        correo: 'ana.gomez@misena.edu.co',
        telefono: '3104445566',
        fichaId: ficha1._id,
        genero: 'Femenino',
        estado: 'Activo',
        huellaEnrolada: false,
        huellaTemplate: '',
        fechaEnrolamiento: ''
      },
      {
        nombres: 'Camilo',
        apellidos: 'Torres',
        tipoDocumento: 'CC',
        numeroDocumento: '1019876543',
        correo: 'camilo.torres@misena.edu.co',
        telefono: '3123334455',
        fichaId: ficha1._id,
        genero: 'Masculino',
        estado: 'Activo',
        huellaEnrolada: true,
        huellaTemplate: 'TEMPLATE_BIOMETRICO_CAMILO_TORRES_002',
        fechaEnrolamiento: '2026-02-12'
      },
      {
        nombres: 'Laura Sofía',
        apellidos: 'Vargas',
        tipoDocumento: 'CC',
        numeroDocumento: '1033445566',
        correo: 'laura.vargas@misena.edu.co',
        telefono: '3157778899',
        fichaId: ficha1._id,
        genero: 'Femenino',
        estado: 'Activo',
        huellaEnrolada: false,
        huellaTemplate: '',
        fechaEnrolamiento: ''
      },
      {
        nombres: 'Diego Fernando',
        apellidos: 'Morales',
        tipoDocumento: 'CC',
        numeroDocumento: '1099887766',
        correo: 'diego.morales@misena.edu.co',
        telefono: '3189990011',
        fichaId: ficha2._id,
        genero: 'Masculino',
        estado: 'Activo',
        huellaEnrolada: true,
        huellaTemplate: 'TEMPLATE_BIOMETRICO_DIEGO_MORALES_003',
        fechaEnrolamiento: '2026-02-15'
      },
      {
        nombres: 'Valentina',
        apellidos: 'Ríos',
        tipoDocumento: 'CC',
        numeroDocumento: '1055443322',
        correo: 'valentina.rios@misena.edu.co',
        telefono: '3172223344',
        fichaId: ficha2._id,
        genero: 'Femenino',
        estado: 'Activo',
        huellaEnrolada: false,
        huellaTemplate: '',
        fechaEnrolamiento: ''
      },
      {
        nombres: 'Mateo',
        apellidos: 'Bermúdez',
        tipoDocumento: 'CC',
        numeroDocumento: '1066778899',
        correo: 'mateo.bermudez@misena.edu.co',
        telefono: '3165556677',
        fichaId: ficha2._id,
        genero: 'Masculino',
        estado: 'Activo',
        huellaEnrolada: false,
        huellaTemplate: '',
        fechaEnrolamiento: ''
      }
    ]

    for (const est of estudiantesData) {
      let existente = await Estudiante.findOne({ numeroDocumento: est.numeroDocumento })
      if (!existente) {
        await new Estudiante(est).save()
        console.log(`✅ Aprendiz ${est.nombres} ${est.apellidos} creado (Huella: ${est.huellaEnrolada ? 'Enrolada' : 'Pendiente'})`)
      } else {
        await Estudiante.updateOne({ numeroDocumento: est.numeroDocumento }, est)
        console.log(`✅ Aprendiz ${est.nombres} ${est.apellidos} actualizado`)
      }
    }

    console.log('\n✨ Carga de datos de prueba completada exitosamente ✨')
    process.exit(0)
  } catch (err) {
    console.error('Error al poblar la base de datos:', err)
    process.exit(1)
  }
}

seed()
