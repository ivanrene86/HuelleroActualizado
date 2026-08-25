function getBaseUrl() {
  if (typeof window === 'undefined') return 'http://localhost:3000/api'
  
  const host = window.location.hostname
  const protocol = window.location.protocol
  const fullHost = window.location.host
  
  // Si se usa VS Code Port Forwarding / Dev Tunnels (ej: abc-5173.use.devtunnels.ms)
  if (fullHost.includes('-5173.')) {
    return `${protocol}//${fullHost.replace('-5173.', '-3000.')}/api`
  }
  
  // Si se accede por IP local (ej: 192.168.1.15) o localhost
  return `${protocol}//${host}:3000/api`
}

const BASE = getBaseUrl()

async function request(url, options = {}) {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error del servidor')
  return data
}

export default {
  auth: {
    login(correo, password) {
      return request('/auth/login', { method: 'POST', body: JSON.stringify({ correo, password }) })
    },
    getPerfil() {
      return request('/auth/perfil')
    },
    updatePerfil(body) {
      return request('/auth/perfil', { method: 'PUT', body: JSON.stringify(body) })
    },
    checkRecoveryEmail(correo) {
      return request('/auth/recovery-code', { method: 'POST', body: JSON.stringify({ correo }) })
    },
    resetPassword(correo, nuevaPassword) {
      return request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ correo, nuevaPassword }) })
    },
  },

  instructores: {
    getAll() { return request('/instructores') },
    create(body) { return request('/instructores', { method: 'POST', body: JSON.stringify(body) }) },
    update(id, body) { return request(`/instructores/${id}`, { method: 'PUT', body: JSON.stringify(body) }) },
    delete(id) { return request(`/instructores/${id}`, { method: 'DELETE' }) },
    importar(instructores) { return request('/instructores/importar', { method: 'POST', body: JSON.stringify({ instructores }) }) },
  },

  fichas: {
    getAll() { return request('/fichas') },
    getMisFichas(instructorId) { return request(`/fichas/mis-fichas/${instructorId}`) },
    getPlantillasBiometricas(id) { return request(`/fichas/${id}/plantillas-biometricas`) },
    create(body) { return request('/fichas', { method: 'POST', body: JSON.stringify(body) }) },
    update(id, body) { return request(`/fichas/${id}`, { method: 'PUT', body: JSON.stringify(body) }) },
    delete(id) { return request(`/fichas/${id}`, { method: 'DELETE' }) },
    importar(fichas) { return request('/fichas/importar', { method: 'POST', body: JSON.stringify({ fichas }) }) },
  },

  estudiantes: {
    getAll(params = {}) {
      const query = new URLSearchParams(params).toString()
      return request(`/estudiantes${query ? '?' + query : ''}`)
    },
    create(body) { return request('/estudiantes', { method: 'POST', body: JSON.stringify(body) }) },
    update(id, body) { return request(`/estudiantes/${id}`, { method: 'PUT', body: JSON.stringify(body) }) },
    enrolarHuella(id, huellaTemplate) { return request(`/estudiantes/${id}/enrolar-huella`, { method: 'PUT', body: JSON.stringify({ huellaTemplate }) }) },
    delete(id) { return request(`/estudiantes/${id}`, { method: 'DELETE' }) },
    importar(estudiantes) { return request('/estudiantes/importar', { method: 'POST', body: JSON.stringify({ estudiantes }) }) },
    fingerprint: {
      enrollStart(studentId, name, documento, dedo) {
        return request('/estudiantes/enroll-start', { method: 'POST', body: JSON.stringify({ studentId, name, documento, dedo }) })
      },
      enrollCapture(sessionId, image) {
        return request('/estudiantes/enroll-capture', { method: 'POST', body: JSON.stringify({ sessionId, image }) })
      },
      enrollComplete(sessionId) {
        return request('/estudiantes/enroll-complete', { method: 'POST', body: JSON.stringify({ sessionId }) })
      },
      enrollCancel(sessionId) {
        return request('/estudiantes/enroll-cancel', { method: 'POST', body: JSON.stringify({ sessionId }) })
      },
      verify(image, fichaId) {
        return request('/estudiantes/verify', { method: 'POST', body: JSON.stringify({ image, fichaId }) })
      },
      status() {
        return request('/estudiantes/fingerprint-status')
      }
    }
  },

  asistencias: {
    getAll(params = {}) {
      const query = new URLSearchParams(params).toString()
      return request(`/asistencias${query ? '?' + query : ''}`)
    },
    create(body) { return request('/asistencias', { method: 'POST', body: JSON.stringify(body) }) },
    inhabilitarJornada(body) { return request('/asistencias/inhabilitar-jornada', { method: 'POST', body: JSON.stringify(body) }) },
    reactivarJornada(body) { return request('/asistencias/reactivar-jornada', { method: 'POST', body: JSON.stringify(body) }) },
    downloadSqliteUrl() { return `${BASE}/asistencias/sqlite/download` },
    syncAllSqlite() { return request('/asistencias/sqlite/sync-all', { method: 'POST' }) },
  },

  excusas: {
    getAll(params = {}) {
      const query = new URLSearchParams(params).toString()
      return request(`/excusas${query ? '?' + query : ''}`)
    },
    create(body) { return request('/excusas', { method: 'POST', body: JSON.stringify(body) }) },
    aprobar(id) { return request(`/excusas/${id}/aprobar`, { method: 'PUT' }) },
    rechazar(id, motivoRechazo) { return request(`/excusas/${id}/rechazar`, { method: 'PUT', body: JSON.stringify({ motivoRechazo }) }) },
  },

  diasFestivos: {
    getAll() { return request('/dias-festivos') },
    create(body) { return request('/dias-festivos', { method: 'POST', body: JSON.stringify(body) }) },
    update(id, body) { return request(`/dias-festivos/${id}`, { method: 'PUT', body: JSON.stringify(body) }) },
    delete(id) { return request(`/dias-festivos/${id}`, { method: 'DELETE' }) },
  },
}
