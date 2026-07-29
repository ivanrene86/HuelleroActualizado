<script setup>
import { ref, reactive } from 'vue'
import { enviarCodigoRecuperacion } from '../services/emailService.js'
import api from '../services/api.js'

const emit = defineEmits(['login-success'])

const form = reactive({
  correo: '',
  password: '',
})

const error = ref('')
const exito = ref('')
const showPassword = ref(false)
const pantalla = ref('login')
const loading = ref(false)

const recuperarForm = reactive({
  correo: '',
  codigo: '',
  nuevaPassword: '',
  confirmarPassword: '',
})

const codigoGenerado = ref('')
const codigoEnviado = ref(false)
const mostrarCodigoEnPantalla = ref(false)
const errorRecuperar = ref('')
const exitoRecuperar = ref('')

const enviando = ref(false)

async function iniciarSesion() {
  error.value = ''
  exito.value = ''

  if (!form.correo || !form.password) {
    error.value = 'Ingresa correo y contrasena'
    return
  }

  loading.value = true
  try {
    const res = await api.auth.login(form.correo, form.password)
    if (res.ok) {
      sessionStorage.setItem('admin_auth', 'true')
      const userData = res.usuario || res.admin
      sessionStorage.setItem('user_data', JSON.stringify(userData))
      emit('login-success', userData)
    }
  } catch (err) {
    error.value = err.message || 'Correo o contrasena incorrectos'
  } finally {
    loading.value = false
  }
}

function irARecuperar() {
  pantalla.value = 'recuperar'
  error.value = ''
  exito.value = ''
  Object.assign(recuperarForm, {
    correo: '',
    codigo: '',
    nuevaPassword: '',
    confirmarPassword: '',
  })
  codigoGenerado.value = ''
  codigoEnviado.value = false
  mostrarCodigoEnPantalla.value = false
  errorRecuperar.value = ''
  exitoRecuperar.value = ''
}

function volverAlLogin() {
  pantalla.value = 'login'
  error.value = ''
  exito.value = ''
}

async function enviarCodigo() {
  errorRecuperar.value = ''
  exitoRecuperar.value = ''

  if (!recuperarForm.correo) {
    errorRecuperar.value = 'Ingresa tu correo electronico'
    return
  }

  try {
    await api.auth.checkRecoveryEmail(recuperarForm.correo)
  } catch (err) {
    errorRecuperar.value = 'El correo ingresado no coincide con el correo registrado del administrador'
    return
  }

  const codigo = String(Math.floor(100000 + Math.random() * 900000))
  codigoGenerado.value = codigo

  const recovery = {
    correo: recuperarForm.correo,
    codigo,
    expira: Date.now() + 10 * 60 * 1000,
  }
  localStorage.setItem('admin_recovery', JSON.stringify(recovery))

  enviando.value = true
  try {
    await enviarCodigoRecuperacion(recuperarForm.correo, codigo)
    codigoEnviado.value = true
    mostrarCodigoEnPantalla.value = false
    exitoRecuperar.value = 'Codigo de verificacion enviado a tu correo. Revisa tu bandeja de entrada.'
  } catch (e) {
    codigoEnviado.value = true
    mostrarCodigoEnPantalla.value = true
    exitoRecuperar.value = 'No se pudo enviar el correo automaticamente. Usa este codigo para continuar.'
  } finally {
    enviando.value = false
  }
}

async function restablecerPassword() {
  errorRecuperar.value = ''
  exitoRecuperar.value = ''

  if (!recuperarForm.codigo) {
    errorRecuperar.value = 'Ingresa el codigo de verificacion'
    return
  }
  if (!recuperarForm.nuevaPassword) {
    errorRecuperar.value = 'Ingresa la nueva contrasena'
    return
  }
  if (recuperarForm.nuevaPassword !== recuperarForm.confirmarPassword) {
    errorRecuperar.value = 'Las contrasenas no coinciden'
    return
  }

  const recoveryData = localStorage.getItem('admin_recovery')
  if (!recoveryData) {
    errorRecuperar.value = 'No hay un codigo de recuperacion generado. Solicita uno nuevo.'
    return
  }

  let recovery
  try { recovery = JSON.parse(recoveryData) } catch(e) {
    errorRecuperar.value = 'Error al leer los datos de recuperacion'
    return
  }

  if (Date.now() > recovery.expira) {
    errorRecuperar.value = 'El codigo ha expirado. Solicita uno nuevo.'
    localStorage.removeItem('admin_recovery')
    return
  }

  if (recuperarForm.codigo !== recovery.codigo) {
    errorRecuperar.value = 'Codigo de verificacion incorrecto'
    return
  }

  try {
    await api.auth.resetPassword(recovery.correo, recuperarForm.nuevaPassword)
    localStorage.removeItem('admin_recovery')
    exitoRecuperar.value = 'Contrasena restablecida correctamente. Redirigiendo al inicio de sesion...'
    setTimeout(() => {
      volverAlLogin()
      exito.value = 'Contrasena restablecida correctamente. Inicia sesion con tu nueva contrasena.'
    }, 2000)
  } catch (err) {
    errorRecuperar.value = err.message || 'Error al restablecer contrasena'
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <div class="login-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
          </svg>
        </div>
        <h2>Panel de Administracion</h2>
        <p>SENA</p>
      </div>

      <template v-if="pantalla === 'login'">
        <div v-if="exito" class="login-exito">{{ exito }}</div>

        <div class="form-group">
          <label>Correo Electronico</label>
          <input
            v-model="form.correo"
            type="email"
            placeholder="admin@correo.com"
            @keyup.enter="iniciarSesion"
          />
        </div>

        <div class="form-group">
          <label>Contrasena</label>
          <div class="password-wrapper">
            <input
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="········"
              @keyup.enter="iniciarSesion"
            />
            <button type="button" class="toggle-password" @click="showPassword = !showPassword">
              <svg v-if="!showPassword" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </button>
          </div>
        </div>

        <div v-if="error" class="login-error">{{ error }}</div>

        <button class="btn btn-primary login-btn" @click="iniciarSesion" :disabled="loading">
          {{ loading ? 'Iniciando...' : 'Iniciar Sesion' }}
        </button>

        <p class="login-forgot">
          <a @click="irARecuperar">Olvidaste tu contrasena?</a>
        </p>
      </template>

      <template v-if="pantalla === 'recuperar'">
        <h3 style="font-size: 16px; font-weight: 600; text-align: center; margin-bottom: 20px; color: var(--text);">
          Recuperar Contrasena
        </h3>

        <div v-if="exitoRecuperar" class="login-exito">{{ exitoRecuperar }}</div>
        <div v-if="errorRecuperar" class="login-error">{{ errorRecuperar }}</div>

        <div class="form-group">
          <label>Correo Electronico Registrado</label>
          <input
            v-model="recuperarForm.correo"
            type="email"
            placeholder="Tu correo registrado"
            :disabled="codigoEnviado"
          />
        </div>

        <button
          v-if="!codigoEnviado"
          class="btn btn-primary login-btn"
          :disabled="enviando"
          @click="enviarCodigo"
        >
          <span v-if="enviando" class="spinner"></span>
          {{ enviando ? 'Enviando...' : 'Enviar Codigo de Verificacion' }}
        </button>

        <template v-if="codigoEnviado">
          <div v-if="mostrarCodigoEnPantalla" class="codigo-display">
            <p>Codigo enviado a <strong>{{ recuperarForm.correo }}</strong>:</p>
            <div class="codigo-numero">{{ codigoGenerado }}</div>
            <p class="codigo-expira">Este codigo expira en 10 minutos</p>
          </div>

          <div class="form-group">
            <label>Codigo de Verificacion</label>
            <input
              v-model="recuperarForm.codigo"
              type="text"
              placeholder="Ingresa el codigo de 6 digitos"
              maxlength="6"
            />
          </div>

          <div class="form-group">
            <label>Nueva Contrasena</label>
            <div class="password-wrapper">
              <input
                v-model="recuperarForm.nuevaPassword"
                type="password"
                placeholder="········"
              />
            </div>
          </div>

          <div class="form-group">
            <label>Confirmar Contrasena</label>
            <div class="password-wrapper">
              <input
                v-model="recuperarForm.confirmarPassword"
                type="password"
                placeholder="········"
              />
            </div>
          </div>

          <button class="btn btn-primary login-btn" @click="restablecerPassword">
            Restablecer Contrasena
          </button>
        </template>

        <p class="login-forgot">
          <a @click="volverAlLogin">Volver al inicio de sesion</a>
        </p>
      </template>
    </div>
  </div>
</template>
