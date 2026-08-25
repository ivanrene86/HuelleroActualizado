<script setup>
import { ref } from 'vue'

const emit = defineEmits(['volver', 'login'])

const correo = ref('')
const password = ref('')
const error = ref('')
const cargando = ref(false)

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function enviar() {
  if (cargando.value) return
  error.value = ''

  const valor = correo.value.trim()
  if (!EMAIL_REGEX.test(valor)) {
    error.value = 'Ingresa un correo electrónico válido'
    return
  }
  if (!password.value) {
    error.value = 'Ingresa la contraseña'
    return
  }

  cargando.value = true
  const res = await emit('login', { correo: valor, password: password.value })
  if (res === true) return

  error.value = res || 'No se pudo iniciar sesión'
  cargando.value = false
}
</script>

<template>
  <div class="login">
    <form class="card" @submit.prevent="enviar">
      <h2>Acceso docente</h2>
      <p class="hint">Inicia sesión para administrar la clase y el enrolamiento.</p>

      <label>
        Correo electrónico
        <input v-model="correo" type="email" autocomplete="email" required autofocus />
      </label>

      <label>
        Contraseña
        <input v-model="password" type="password" autocomplete="current-password" />
      </label>

      <p v-if="error" class="error">{{ error }}</p>

      <button class="primary" type="submit" :disabled="cargando">
        {{ cargando ? 'Verificando…' : 'Entrar' }}
      </button>

      <button class="ghost" type="button" @click="emit('volver')">Volver</button>
    </form>
  </div>
</template>

<style scoped>
.login {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.card {
  width: 340px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: var(--bg-elev);
  padding: 28px;
  border-radius: 16px;
}

h2 {
  margin: 0;
}

.hint {
  margin: 0 0 6px;
  color: var(--muted);
  font-size: 14px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
  color: var(--muted);
}

.error {
  margin: 0;
  color: var(--danger);
  font-size: 14px;
}
</style>
