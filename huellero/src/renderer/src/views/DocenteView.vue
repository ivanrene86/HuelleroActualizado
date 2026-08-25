<script setup>
import { computed, ref } from 'vue'
import EnrolarHuellaModal from './EnrolarHuellaModal.vue'

const props = defineProps({
  status: { type: Object, required: true },
})

const emit = defineEmits(['logout'])

const nombre = computed(() => props.status.docente?.nombre || 'Docente')
const rolDetallado = computed(() => props.status.docente?.rolDetallado || 'Instructor')
const esLider = computed(() => !!props.status.docente?.esLider)

const modalAbierto = ref(false)
</script>

<template>
  <div class="docente">
    <header>
      <div>
        <h1>Modo docente</h1>
        <span class="nombre">{{ nombre }} · {{ rolDetallado }}</span>
      </div>
      <div class="acciones">
        <button v-if="esLider" class="primary" @click="modalAbierto = true">Registrar huella</button>
        <button class="secondary" @click="emit('logout')">Cerrar sesión</button>
      </div>
    </header>

    <main class="contenido">
      <p v-if="esLider">Como líder puedes registrar las huellas de los estudiantes de tu ficha.</p>
      <p v-else class="hint">Solo los instructores líderes pueden registrar huellas.</p>
    </main>

    <EnrolarHuellaModal
      v-if="modalAbierto"
      :clase-activa="status.claseActiva"
      @close="modalAbierto = false"
    />
  </div>
</template>

<style scoped>
.docente {
  height: 100%;
  display: flex;
  flex-direction: column;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px;
  border-bottom: 1px solid #1e293b;
}

header div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

h1 {
  margin: 0;
  font-size: 20px;
}

.nombre {
  color: var(--muted);
  font-size: 14px;
}

.acciones {
  display: flex;
  flex-direction: row;
  gap: 10px;
}

.contenido {
  flex: 1;
  padding: 24px;
}

.hint {
  color: var(--muted);
}
</style>
