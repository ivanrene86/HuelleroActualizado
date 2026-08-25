import * as store from './store.js'

export async function syncPendientes() {
  // TODO Fase 10: sincronización idempotente de pendientes hacia el backend
  // (POST /api/asistencias/sync con UUID). Cron de las 12:00 AM + reintentos.
  const pendientes = store.getPendientes()
  return { procesados: pendientes.length, ok: true }
}
