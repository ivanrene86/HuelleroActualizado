// Script DESECHABLE de verificación de dpfpdd.dll (Fase 5 — captura DigitalPersona)
// NO es parte del flujo de producción. Solo prueba: dpfpdd_version, dpfpdd_init, dpfpdd_query_devices.
// Uso: node huellero/src/main/_test-dpfpdd.js

import koffi from 'koffi'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dllFolder = path.resolve(__dirname, '../../dll')

// Mismo patrón de dllFolder/PATH que fingerprint.js
process.env.PATH = `${dllFolder};${process.env.PATH}`

console.log('=== [1] Declaración de structs (según dpfpdd.h oficial) ===')

const DPFPDD_VER_INFO = koffi.struct('DPFPDD_VER_INFO', {
  major: 'int',
  minor: 'int',
  maintenance: 'int',
})

const DPFPDD_VERSION = koffi.struct('DPFPDD_VERSION', {
  size: 'uint32',
  lib_ver: DPFPDD_VER_INFO,
  api_ver: DPFPDD_VER_INFO,
})

const DPFPDD_HW_DESCR = koffi.struct('DPFPDD_HW_DESCR', {
  vendor_name: koffi.array('char', 128),
  product_name: koffi.array('char', 128),
  serial_num: koffi.array('char', 128),
})

const DPFPDD_HW_ID = koffi.struct('DPFPDD_HW_ID', {
  vendor_id: 'uint16',
  product_id: 'uint16',
})

const DPFPDD_HW_VERSION = koffi.struct('DPFPDD_HW_VERSION', {
  hw_ver: DPFPDD_VER_INFO,
  fw_ver: DPFPDD_VER_INFO,
  bcd_rev: 'uint16',
})

const DPFPDD_DEV_INFO = koffi.struct('DPFPDD_DEV_INFO', {
  size: 'uint32',
  name: koffi.array('char', 1024),
  descr: DPFPDD_HW_DESCR,
  id: DPFPDD_HW_ID,
  ver: DPFPDD_HW_VERSION,
  modality: 'uint32',
  technology: 'uint32',
})

console.log(`sizeof(DPFPDD_VERSION) = ${koffi.sizeof(DPFPDD_VERSION)}`)
console.log(`sizeof(DPFPDD_DEV_INFO) = ${koffi.sizeof(DPFPDD_DEV_INFO)}`)
console.log('Structs declarados OK')

console.log('\n=== [2] Carga de dpfpdd.dll ===')

const searchPaths = [
  path.join(dllFolder, 'dpfpdd.dll'),
  'C:/Program Files/DigitalPersona/U.are.U SDK/Windows/Lib/x64/dpfpdd.dll',
  'C:/Program Files/DigitalPersona/U.are.U SDK/Windows/Lib/win32/dpfpdd.dll',
]

let dpfpdd = null
for (const p of searchPaths) {
  try {
    dpfpdd = koffi.load(p)
    console.log(`[test] dpfpdd.dll cargada desde: ${p}`)
    break
  } catch (err) {
    console.log(`[test] No se pudo cargar desde ${p}: ${err.message}`)
  }
}

if (!dpfpdd) {
  console.error('[test] ❌ No se pudo cargar dpfpdd.dll de ninguna ubicación')
  process.exit(1)
}

console.log('\n=== [3] Declaración de funciones (__stdcall) ===')

let dpfpdd_version, dpfpdd_init, dpfpdd_query_devices
try {
  dpfpdd_version = dpfpdd.func('__stdcall', 'dpfpdd_version', 'int', [koffi.pointer(DPFPDD_VERSION)])
  dpfpdd_init = dpfpdd.func('__stdcall', 'dpfpdd_init', 'int', [])
  dpfpdd_query_devices = dpfpdd.func('__stdcall', 'dpfpdd_query_devices', 'int', [koffi.pointer('uint32'), koffi.pointer(DPFPDD_DEV_INFO)])
  console.log('Funciones declaradas OK')
} catch (err) {
  console.error('[test] ❌ Error declarando funciones:', err)
  process.exit(1)
}

const fmtRc = (rc) => `${rc} (0x${(rc >>> 0).toString(16).toUpperCase()})`

console.log('\n=== [4a] dpfpdd_version() ===')
try {
  const verBuf = Buffer.alloc(koffi.sizeof(DPFPDD_VERSION))
  verBuf.writeUInt32LE(koffi.sizeof(DPFPDD_VERSION), 0)

  const rc = dpfpdd_version(verBuf)
  console.log(`retorno dpfpdd_version = ${fmtRc(rc)}`)

  const ver = koffi.decode(verBuf, DPFPDD_VERSION)
  console.log(`lib_ver = ${ver.lib_ver.major}.${ver.lib_ver.minor}.${ver.lib_ver.maintenance}`)
  console.log(`api_ver = ${ver.api_ver.major}.${ver.api_ver.minor}.${ver.api_ver.maintenance}`)
} catch (err) {
  console.error('[test] ❌ Error en dpfpdd_version:', err)
}

console.log('\n=== [4b] dpfpdd_init() ===')
try {
  const rc = dpfpdd_init()
  console.log(`retorno dpfpdd_init = ${fmtRc(rc)} ${rc === 0 ? '(DPFPDD_SUCCESS)' : ''}`)
} catch (err) {
  console.error('[test] ❌ Error en dpfpdd_init:', err)
}

console.log('\n=== [4c] dpfpdd_query_devices() ===')
try {
  const countBuf = Buffer.alloc(4)
  countBuf.writeUInt32LE(0, 0)

  const rc1 = dpfpdd_query_devices(countBuf, null)
  const count = countBuf.readUInt32LE(0)
  console.log(`1ª llamada (dev_infos = NULL) -> retorno = ${fmtRc(rc1)}, conteo = ${count}`)

  if (count > 0) {
    const itemSize = koffi.sizeof(DPFPDD_DEV_INFO)
    const devBuf = Buffer.alloc(itemSize * count)

    for (let i = 0; i < count; i++) {
      devBuf.writeUInt32LE(itemSize, i * itemSize)
    }

    countBuf.writeUInt32LE(count, 0)
    const rc2 = dpfpdd_query_devices(countBuf, devBuf)
    const count2 = countBuf.readUInt32LE(0)
    console.log(`2ª llamada (buffer de ${count} entries) -> retorno = ${fmtRc(rc2)}, conteo = ${count2}`)

    const devInfos = koffi.decode(devBuf, DPFPDD_DEV_INFO, count2)
    devInfos.forEach((d, i) => {
      console.log(`--- Dispositivo #${i} ---`)
      console.log(`  name         : ${d.name}`)
      console.log(`  vendor_name  : ${d.descr.vendor_name}`)
      console.log(`  product_name : ${d.descr.product_name}`)
      console.log(`  serial_num   : ${d.descr.serial_num}`)
      console.log(`  vendor_id    : 0x${d.id.vendor_id.toString(16).toUpperCase()}`)
      console.log(`  product_id   : 0x${d.id.product_id.toString(16).toUpperCase()}`)
      console.log(`  hw_ver       : ${d.ver.hw_ver.major}.${d.ver.hw_ver.minor}.${d.ver.hw_ver.maintenance}`)
      console.log(`  fw_ver       : ${d.ver.fw_ver.major}.${d.ver.fw_ver.minor}.${d.ver.fw_ver.maintenance}`)
      console.log(`  bcd_rev      : ${d.ver.bcd_rev}`)
      console.log(`  modality     : ${d.modality}`)
      console.log(`  technology   : ${d.technology}`)
    })
  } else {
    console.log('[test] No se detectó ningún lector conectado (conteo = 0).')
  }
} catch (err) {
  console.error('[test] ❌ Error en dpfpdd_query_devices:', err)
}

console.log('\n[test] Fin de la verificación.')
