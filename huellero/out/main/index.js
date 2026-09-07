import { ipcMain, app, BrowserWindow } from "electron";
import path, { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { io } from "socket.io-client";
import koffi from "koffi";
import { PNG } from "pngjs";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
const CONFIG_PATH = resolve(process.cwd(), "config.json");
const DEFAULTS = {
  deviceId: null,
  token: null,
  backendUrl: process.env.HUELLERO_BACKEND_URL || "http://localhost:3000",
  wsUrl: process.env.HUELLERO_WS_URL || "ws://localhost:3000"
};
let cache = null;
function getConfig() {
  if (cache) return cache;
  if (existsSync(CONFIG_PATH)) {
    try {
      cache = { ...DEFAULTS, ...JSON.parse(readFileSync(CONFIG_PATH, "utf8")) };
    } catch {
      cache = { ...DEFAULTS };
    }
  } else {
    cache = { ...DEFAULTS };
  }
  return cache;
}
function saveConfig(patch) {
  cache = { ...getConfig(), ...patch };
  writeFileSync(CONFIG_PATH, JSON.stringify(cache, null, 2), "utf8");
  return cache;
}
async function registrarDispositivoSiNoExiste() {
  const config = getConfig();
  if (config.deviceId && config.token) {
    return { ok: true, yaRegistrado: true, deviceId: config.deviceId };
  }
  let res;
  try {
    res = await fetch(`${config.backendUrl}/api/dispositivos/registrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(1e4)
    });
  } catch {
    return { ok: false, error: "Sin conexión: no se pudo registrar el dispositivo" };
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    return { ok: false, error: data?.error || "No se pudo registrar el dispositivo" };
  }
  const { deviceId, token } = await res.json().catch(() => ({}));
  if (!deviceId || !token) {
    return { ok: false, error: "Respuesta inválida al registrar el dispositivo" };
  }
  saveConfig({ deviceId, token });
  return { ok: true, yaRegistrado: false, deviceId };
}
let onRegistradoCb = null;
function tieneIdentidad() {
  const c = getConfig();
  return Boolean(c.deviceId && c.token);
}
function iniciarRegistroDispositivo(onRegistrado) {
  onRegistradoCb = onRegistrado || null;
  void intentarRegistro();
}
async function intentarRegistro() {
  const resultado = await registrarDispositivoSiNoExiste();
  if (resultado.ok) {
    if (resultado.yaRegistrado === false && onRegistradoCb) {
      onRegistradoCb(resultado);
    }
    return;
  }
  setTimeout(intentarRegistro, 6e4);
}
const DATA_DIR = resolve(process.cwd(), "data");
const PLANTILLAS_PATH = resolve(DATA_DIR, "plantillas.json");
const PENDIENTES_PATH = resolve(DATA_DIR, "pendientes.json");
const ESTADO_PATH = resolve(DATA_DIR, "estado.json");
let estado = { claseActiva: null };
let plantillas = {};
let pendientes = [];
function asegurarDirectorio() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}
function leerJSON(ruta, porDefecto) {
  if (!existsSync(ruta)) return porDefecto;
  try {
    return JSON.parse(readFileSync(ruta, "utf8"));
  } catch {
    return porDefecto;
  }
}
function escribirJSON(ruta, valor) {
  writeFileSync(ruta, JSON.stringify(valor, null, 2), "utf8");
}
function persistirEstado() {
  escribirJSON(ESTADO_PATH, estado);
}
async function init$1() {
  asegurarDirectorio();
  if (!existsSync(ESTADO_PATH)) {
    escribirJSON(ESTADO_PATH, { claseActiva: null });
  }
  if (!existsSync(PLANTILLAS_PATH)) {
    escribirJSON(PLANTILLAS_PATH, {});
  }
  if (!existsSync(PENDIENTES_PATH)) {
    escribirJSON(PENDIENTES_PATH, []);
  }
  estado = leerJSON(ESTADO_PATH, { claseActiva: null }) || { claseActiva: null };
  plantillas = leerJSON(PLANTILLAS_PATH, {}) || {};
  pendientes = leerJSON(PENDIENTES_PATH, []);
  if (!Array.isArray(pendientes)) pendientes = [];
  if (typeof plantillas !== "object" || plantillas === null) plantillas = {};
  if (typeof estado !== "object" || estado === null) estado = { claseActiva: null };
}
function getClaseActiva() {
  return estado.claseActiva || null;
}
function setClaseActiva(clase) {
  estado.claseActiva = clase || null;
  persistirEstado();
}
async function getPlantillasFicha(fichaId) {
  const clave = String(fichaId);
  const lista = plantillas[clave];
  return Array.isArray(lista) ? lista : [];
}
function getPendientes() {
  return pendientes;
}
let socket = null;
let online = false;
let onStatusChange = null;
function connect(config) {
  if (!config.deviceId || !config.token || !config.wsUrl) {
    online = false;
    return;
  }
  if (socket) {
    socket.disconnect();
  }
  socket = io(config.wsUrl, {
    transports: ["websocket", "polling"],
    reconnection: true,
    // Backoff de reconexión: empieza en 2s y duplica hasta un máximo de 30s entre intentos.
    reconnectionDelay: 2e3,
    reconnectionDelayMax: 3e4
  });
  socket.on("connect", () => {
    online = true;
    socket.emit("HELLO", { deviceId: config.deviceId, token: config.token });
    notifyStatus();
  });
  socket.on("disconnect", () => {
    online = false;
    notifyStatus();
  });
  socket.on("ACTIVATE", (payload) => {
    setClaseActiva({
      fichaId: payload?.fichaId ?? null,
      instructorId: payload?.instructorId ?? null,
      estado: "Activa"
    });
  });
}
function getConnectionStatus() {
  return online;
}
function setOnStatusChange(cb) {
  onStatusChange = cb;
}
function notifyStatus() {
  if (onStatusChange) onStatusChange();
}
const __dirname$3 = path.dirname(fileURLToPath(import.meta.url));
const dllFolder$1 = path.resolve(__dirname$3, "../../dll");
process.env.PATH = `${dllFolder$1};${process.env.PATH}`;
const DPFPDD_SUCCESS = 0;
const _DP_FACILITY = 1466;
const DPERROR = (err) => err | _DP_FACILITY << 16;
const DPFPDD_E_FAILURE = DPERROR(11);
const DPFPDD_E_NO_DATA = DPERROR(12);
const DPFPDD_E_MORE_DATA = DPERROR(13);
const DPFPDD_E_INVALID_PARAMETER = DPERROR(20);
const DPFPDD_E_INVALID_DEVICE = DPERROR(21);
const DPFPDD_E_DEVICE_BUSY = DPERROR(30);
const DPFPDD_E_DEVICE_FAILURE = DPERROR(31);
const DPFPDD_IMG_FMT_PIXEL_BUFFER = 0;
const DPFPDD_IMG_PROC_DEFAULT = 0;
const DPFPDD_QUALITY_TIMED_OUT = 1;
const DPFPDD_QUALITY_CANCELED = 1 << 1;
const DPFPDD_QUALITY_NO_FINGER = 1 << 2;
const DPFPDD_QUALITY_FAKE_FINGER = 1 << 3;
const DPFPDD_QUALITY_FINGER_TOO_LEFT = 1 << 4;
const DPFPDD_QUALITY_FINGER_TOO_RIGHT = 1 << 5;
const DPFPDD_QUALITY_FINGER_TOO_HIGH = 1 << 6;
const DPFPDD_QUALITY_FINGER_TOO_LOW = 1 << 7;
const DPFPDD_QUALITY_FINGER_OFF_CENTER = 1 << 8;
const DPFPDD_QUALITY_SCAN_SKEWED = 1 << 9;
const DPFPDD_QUALITY_SCAN_TOO_SHORT = 1 << 10;
const DPFPDD_QUALITY_SCAN_TOO_LONG = 1 << 11;
const DPFPDD_QUALITY_SCAN_TOO_SLOW = 1 << 12;
const DPFPDD_QUALITY_SCAN_TOO_FAST = 1 << 13;
const DPFPDD_QUALITY_SCAN_WRONG_DIRECTION = 1 << 14;
const DPFPDD_QUALITY_READER_DIRTY = 1 << 15;
const DPI_FALLBACK = 500;
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const TIMEOUT_CAPTURA_MS = 1e4;
const DPFPDD_VER_INFO = koffi.struct("DPFPDD_VER_INFO", {
  major: "int",
  minor: "int",
  maintenance: "int"
});
const DPFPDD_HW_DESCR = koffi.struct("DPFPDD_HW_DESCR", {
  vendor_name: koffi.array("char", 128),
  product_name: koffi.array("char", 128),
  serial_num: koffi.array("char", 128)
});
const DPFPDD_HW_ID = koffi.struct("DPFPDD_HW_ID", {
  vendor_id: "uint16",
  product_id: "uint16"
});
const DPFPDD_HW_VERSION = koffi.struct("DPFPDD_HW_VERSION", {
  hw_ver: DPFPDD_VER_INFO,
  fw_ver: DPFPDD_VER_INFO,
  bcd_rev: "uint16"
});
const DPFPDD_DEV_INFO = koffi.struct("DPFPDD_DEV_INFO", {
  size: "uint32",
  name: koffi.array("char", 1024),
  descr: DPFPDD_HW_DESCR,
  id: DPFPDD_HW_ID,
  ver: DPFPDD_HW_VERSION,
  modality: "uint32",
  technology: "uint32"
});
const DPFPDD_DEV_CAPS = koffi.struct("DPFPDD_DEV_CAPS", {
  size: "uint32",
  can_capture_image: "int",
  can_stream_image: "int",
  can_extract_features: "int",
  can_match: "int",
  can_identify: "int",
  has_fp_storage: "int",
  indicator_type: "uint32",
  has_pwr_mgmt: "int",
  has_calibration: "int",
  piv_compliant: "int",
  resolution_cnt: "uint32",
  resolutions: koffi.array("uint32", 16)
});
const DPFPDD_CAPTURE_PARAM = koffi.struct("DPFPDD_CAPTURE_PARAM", {
  size: "uint32",
  image_fmt: "uint32",
  image_proc: "uint32",
  image_res: "uint32"
});
const DPFPDD_IMAGE_INFO = koffi.struct("DPFPDD_IMAGE_INFO", {
  size: "uint32",
  width: "uint32",
  height: "uint32",
  res: "uint32",
  bpp: "uint32"
});
const DPFPDD_CAPTURE_RESULT = koffi.struct("DPFPDD_CAPTURE_RESULT", {
  size: "uint32",
  success: "int",
  quality: "uint32",
  score: "uint32",
  info: DPFPDD_IMAGE_INFO
});
const DPFPDD_DEV = koffi.opaque("DPFPDD_DEV");
let dpfpdd = null;
let inicializado = false;
let errorInicializacion = null;
let dpfpdd_init, dpfpdd_query_devices, dpfpdd_open, dpfpdd_close;
let dpfpdd_get_device_capabilities, dpfpdd_capture;
function describirError(code) {
  switch (code) {
    case DPFPDD_SUCCESS:
      return "éxito";
    case DPFPDD_E_FAILURE:
      return "fallo general";
    case DPFPDD_E_NO_DATA:
      return "no hay datos disponibles";
    case DPFPDD_E_MORE_DATA:
      return "el buffer asignado es demasiado pequeño";
    case DPFPDD_E_INVALID_PARAMETER:
      return "parámetro inválido";
    case DPFPDD_E_INVALID_DEVICE:
      return "manejador de lector inválido";
    case DPFPDD_E_DEVICE_BUSY:
      return "el lector está ocupado (otra operación en curso)";
    case DPFPDD_E_DEVICE_FAILURE:
      return "fallo del lector";
    default:
      return `código de error desconocido (0x${(code >>> 0).toString(16)})`;
  }
}
function describirCalidad(code) {
  switch (code) {
    case DPFPDD_QUALITY_TIMED_OUT:
      return "Tiempo de espera agotado: no se detectó ninguna huella";
    case DPFPDD_QUALITY_CANCELED:
      return "La captura fue cancelada";
    case DPFPDD_QUALITY_NO_FINGER:
      return "No se detectó un dedo en el lector";
    case DPFPDD_QUALITY_FAKE_FINGER:
      return "Se detectó un dedo falso";
    case DPFPDD_QUALITY_FINGER_TOO_LEFT:
      return "El dedo está demasiado a la izquierda";
    case DPFPDD_QUALITY_FINGER_TOO_RIGHT:
      return "El dedo está demasiado a la derecha";
    case DPFPDD_QUALITY_FINGER_TOO_HIGH:
      return "El dedo está demasiado arriba";
    case DPFPDD_QUALITY_FINGER_TOO_LOW:
      return "El dedo está demasiado abajo";
    case DPFPDD_QUALITY_FINGER_OFF_CENTER:
      return "El dedo no está centrado en el lector";
    case DPFPDD_QUALITY_SCAN_SKEWED:
      return "La lectura está demasiado inclinada";
    case DPFPDD_QUALITY_SCAN_TOO_SHORT:
      return "La lectura es demasiado corta";
    case DPFPDD_QUALITY_SCAN_TOO_LONG:
      return "La lectura es demasiado larga";
    case DPFPDD_QUALITY_SCAN_TOO_SLOW:
      return "El barrido fue demasiado lento";
    case DPFPDD_QUALITY_SCAN_TOO_FAST:
      return "El barrido fue demasiado rápido";
    case DPFPDD_QUALITY_SCAN_WRONG_DIRECTION:
      return "Dirección de barrido incorrecta";
    case DPFPDD_QUALITY_READER_DIRTY:
      return "El lector necesita limpieza";
    default:
      return `Calidad de imagen insuficiente (código ${code})`;
  }
}
function cargarBiblioteca() {
  const searchPaths2 = [
    path.join(dllFolder$1, "dpfpdd.dll"),
    "C:/Program Files/DigitalPersona/U.are.U SDK/Windows/Lib/x64/dpfpdd.dll",
    "C:/Program Files/DigitalPersona/U.are.U SDK/Windows/Lib/win32/dpfpdd.dll"
  ];
  for (const p of searchPaths2) {
    try {
      dpfpdd = koffi.load(p);
      console.log(`[capture] dpfpdd.dll cargada desde: ${p}`);
      return;
    } catch (err) {
      console.log(`[capture] No se pudo cargar desde ${p}: ${err.message}`);
    }
  }
  throw new Error("No se pudo cargar dpfpdd.dll de ninguna ubicación. Verifica el driver/SDK de DigitalPersona y el Visual C++ Redistributable x64.");
}
function declararBindings() {
  dpfpdd_init = dpfpdd.func("__stdcall", "dpfpdd_init", "int", []);
  dpfpdd_query_devices = dpfpdd.func("__stdcall", "dpfpdd_query_devices", "int", [koffi.pointer("uint32"), koffi.pointer(DPFPDD_DEV_INFO)]);
  dpfpdd_open = dpfpdd.func("__stdcall", "dpfpdd_open", "int", ["str", koffi.out(koffi.pointer(DPFPDD_DEV, 2))]);
  dpfpdd_close = dpfpdd.func("__stdcall", "dpfpdd_close", "int", [koffi.pointer(DPFPDD_DEV)]);
  dpfpdd_get_device_capabilities = dpfpdd.func("__stdcall", "dpfpdd_get_device_capabilities", "int", [koffi.pointer(DPFPDD_DEV), koffi.pointer(DPFPDD_DEV_CAPS)]);
  dpfpdd_capture = dpfpdd.func("__stdcall", "dpfpdd_capture", "int", [
    koffi.pointer(DPFPDD_DEV),
    koffi.pointer(DPFPDD_CAPTURE_PARAM),
    "uint32",
    koffi.inout(koffi.pointer(DPFPDD_CAPTURE_RESULT)),
    koffi.pointer("uint32"),
    koffi.pointer("uint8")
  ]);
}
function inicializarCaptura() {
  if (inicializado) return true;
  try {
    if (!dpfpdd) cargarBiblioteca();
    declararBindings();
    const rc = dpfpdd_init();
    if (rc !== DPFPDD_SUCCESS) {
      throw new Error(`dpfpdd_init() falló: ${describirError(rc)}`);
    }
    inicializado = true;
    errorInicializacion = null;
    console.log("[capture] dpfpdd_init() OK — librería lista para capturar.");
    return true;
  } catch (err) {
    inicializado = false;
    errorInicializacion = err.message;
    console.error(`[capture] Error de inicialización: ${err.message}`);
    return false;
  }
}
function obtenerDispositivos() {
  const countBuf = Buffer.alloc(4);
  const rc1 = dpfpdd_query_devices(countBuf, null);
  const count = countBuf.readUInt32LE(0);
  if (count === 0) {
    return [];
  }
  if (rc1 !== DPFPDD_SUCCESS && rc1 !== DPFPDD_E_MORE_DATA) {
    throw new Error(`dpfpdd_query_devices() falló: ${describirError(rc1)}`);
  }
  const itemSize = koffi.sizeof(DPFPDD_DEV_INFO);
  const devBuf = Buffer.alloc(itemSize * count);
  for (let i = 0; i < count; i++) {
    devBuf.writeUInt32LE(itemSize, i * itemSize);
  }
  countBuf.writeUInt32LE(count, 0);
  const rc2 = dpfpdd_query_devices(countBuf, devBuf);
  if (rc2 !== DPFPDD_SUCCESS) {
    throw new Error(`dpfpdd_query_devices() (2ª llamada) falló: ${describirError(rc2)}`);
  }
  return koffi.decode(devBuf, DPFPDD_DEV_INFO, count);
}
function abrirDispositivo(devName) {
  const outDev = [null];
  const rc = dpfpdd_open(devName, outDev);
  if (rc !== DPFPDD_SUCCESS) {
    throw new Error(`dpfpdd_open() falló: ${describirError(rc)}`);
  }
  if (!outDev[0]) {
    throw new Error("dpfpdd_open() devolvió un manejador de lector nulo");
  }
  return outDev[0];
}
function cerrarDispositivo(dev) {
  if (!dev) return;
  try {
    const rc = dpfpdd_close(dev);
    if (rc !== DPFPDD_SUCCESS) {
      console.warn(`[capture] dpfpdd_close() devolvió: ${describirError(rc)}`);
    }
  } catch (err) {
    console.warn(`[capture] Error al cerrar el lector: ${err.message}`);
  }
}
function obtenerResolucion(dev) {
  try {
    const capBuf = Buffer.alloc(koffi.sizeof(DPFPDD_DEV_CAPS));
    capBuf.writeUInt32LE(koffi.sizeof(DPFPDD_DEV_CAPS), 0);
    const rc = dpfpdd_get_device_capabilities(dev, capBuf);
    if (rc !== DPFPDD_SUCCESS) {
      console.warn(`[capture] No se pudieron leer capacidades del lector (${describirError(rc)}). Usando resolución ${DPI_FALLBACK} DPI.`);
      return DPI_FALLBACK;
    }
    const caps = koffi.decode(capBuf, DPFPDD_DEV_CAPS);
    const resoluciones = Array.from(caps.resolutions.slice(0, caps.resolution_cnt || 0));
    console.log(`[capture] Capacidades del lector: resoluciones=${JSON.stringify(resoluciones)}, can_capture_image=${caps.can_capture_image}`);
    if (resoluciones.length > 0) return resoluciones[0];
    return DPI_FALLBACK;
  } catch (err) {
    console.warn(`[capture] Error leyendo capacidades (${err.message}). Usando resolución ${DPI_FALLBACK} DPI.`);
    return DPI_FALLBACK;
  }
}
function capturarImagen(dev, timeoutMs, dpi) {
  const captureParam = {
    size: koffi.sizeof(DPFPDD_CAPTURE_PARAM),
    image_fmt: DPFPDD_IMG_FMT_PIXEL_BUFFER,
    image_proc: DPFPDD_IMG_PROC_DEFAULT,
    image_res: dpi
  };
  const captureResult = {
    size: koffi.sizeof(DPFPDD_CAPTURE_RESULT),
    info: { size: koffi.sizeof(DPFPDD_IMAGE_INFO) }
  };
  const sizeBuf = Buffer.alloc(4);
  sizeBuf.writeUInt32LE(MAX_IMAGE_SIZE, 0);
  const imageBuf = Buffer.alloc(MAX_IMAGE_SIZE);
  const rc = dpfpdd_capture(dev, captureParam, timeoutMs, captureResult, sizeBuf, imageBuf);
  if (rc !== DPFPDD_SUCCESS) {
    throw new Error(`dpfpdd_capture() falló: ${describirError(rc)}`);
  }
  const { success, quality, score, info } = captureResult;
  if (success !== 1) {
    throw new Error(describirCalidad(quality));
  }
  if (info.bpp !== 8) {
    throw new Error(`Formato de imagen inesperado: bpp=${info.bpp} (solo se soporta 8 bits por píxel en escala de grises)`);
  }
  const numPixels = info.width * info.height;
  const imageSize = sizeBuf.readUInt32LE(0);
  if (imageSize < numPixels) {
    throw new Error(`Tamaño de imagen insuficiente: se esperaban ${numPixels} bytes, se recibieron ${imageSize}`);
  }
  console.log(`[capture] Huella capturada: ${info.width}x${info.height} @ ${info.res} dpi, bpp=${info.bpp}, score=${score}`);
  return { gray: imageBuf.subarray(0, numPixels), width: info.width, height: info.height };
}
function grayscaleToPngBase64(gray, width, height) {
  const png = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) {
    const g = gray[i];
    const o = i * 4;
    png.data[o] = g;
    png.data[o + 1] = g;
    png.data[o + 2] = g;
    png.data[o + 3] = 255;
  }
  return PNG.sync.write(png).toString("base64");
}
async function capturarHuella(timeoutMs = TIMEOUT_CAPTURA_MS) {
  if (!inicializarCaptura()) {
    throw new Error(errorInicializacion || "No se pudo inicializar el lector de huellas");
  }
  const dispositivos = obtenerDispositivos();
  if (dispositivos.length === 0) {
    throw new Error("No se detectó ningún lector de huellas conectado");
  }
  const devName = dispositivos[0].name;
  const dev = abrirDispositivo(devName);
  try {
    const dpi = obtenerResolucion(dev);
    const { gray, width, height } = capturarImagen(dev, timeoutMs, dpi);
    const imagen = grayscaleToPngBase64(gray, width, height);
    return { imagen, dpi };
  } finally {
    cerrarDispositivo(dev);
  }
}
async function syncPendientes() {
  const pendientes2 = getPendientes();
  return { procesados: pendientes2.length, ok: true };
}
const __dirname$2 = path.dirname(fileURLToPath(import.meta.url));
const dllFolder = path.resolve(__dirname$2, "../dll");
process.env.PATH = `${dllFolder};${process.env.PATH}`;
const DPFJ_SUCCESS = 0;
const DPFJ_FMD_ANSI_378_2004 = 1769473;
const DPFJ_POSITION_UNKNOWN = 0;
let MAX_FMD_SIZE = 26 + 4 + 255 * 6 + 2;
const MATCH_THRESHOLD = Number(process.env.BIOMETRIC_MATCH_THRESHOLD) || 21474;
let dpfj = null;
try {
  koffi.load(path.join(dllFolder, "dpfpdd.dll"));
} catch (_) {
}
const searchPaths = [
  path.join(dllFolder, "dpfj.dll"),
  "./dll/dpfj.dll",
  "dpfj.dll",
  "C:/Windows/System32/dpfj.dll",
  "C:/Program Files/DigitalPersona/U.are.U SDK/Windows/Lib/x64/dpfj.dll",
  "C:/Program Files (x86)/DigitalPersona/U.are.U SDK/Windows/Lib/x64/dpfj.dll"
];
for (const p of searchPaths) {
  try {
    dpfj = koffi.load(p);
    console.log(`[fingerprint] dpfj.dll cargado exitosamente desde: ${p}`);
    break;
  } catch (err) {
    console.log(`[fingerprint] No se pudo cargar desde ${p}: ${err.message}`);
  }
}
if (!dpfj) {
  console.error("[fingerprint] ❌ No se pudo cargar dpfj.dll de ninguna ubicación. Asegúrese de tener instalado el driver/SDK de DigitalPersona y Visual C++ Redistributable x64.");
}
let dpfj_finish_enrollment, dpfj_create_fmd_from_raw, dpfj_compare;
if (dpfj) {
  dpfj.func("dpfj_start_enrollment", "int", ["int"]);
  dpfj.func("dpfj_add_to_enrollment", "int", ["int", "void*", "uint32", "uint32"]);
  dpfj.func("dpfj_create_enrollment_fmd", "int", ["void*", "void*"]);
  dpfj_finish_enrollment = dpfj.func("dpfj_finish_enrollment", "int", []);
  dpfj_create_fmd_from_raw = dpfj.func("dpfj_create_fmd_from_raw", "int", [
    "void*",
    "uint32",
    "uint32",
    "uint32",
    "uint32",
    "int",
    "uint32",
    "int",
    "void*",
    "void*"
  ]);
  dpfj_compare = dpfj.func("dpfj_compare", "int", [
    "int",
    "void*",
    "uint32",
    "uint32",
    "int",
    "void*",
    "uint32",
    "uint32",
    "void*"
  ]);
  try {
    dpfj_finish_enrollment();
  } catch (_) {
  }
}
function bufFromBase64(b64) {
  return Buffer.from(b64, "base64");
}
function makeSizeBuf(value) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(value, 0);
  return b;
}
function readSizeBuf(b) {
  return b.readUInt32LE(0);
}
function dpfjError(code) {
  const errors = {
    0: "Éxito",
    96075787: "Error: Fallo general",
    96075789: "Error: Se requiere más memoria",
    96075796: "Error: Parámetro inválido",
    96075977: "Error: FMD inválido - la captura no fue buena, intenta de nuevo",
    96075877: "Error: FID inválido",
    96075878: "Error: Área de huella muy pequeña",
    96076077: "Error: Hay un enrollment en progreso",
    96076078: "Error: Enrollment no iniciado",
    96076079: "Error: Se necesitan más capturas",
    96076080: "Error: Las capturas no son consistentes, intenta de nuevo"
  };
  return errors[code] || `Error desconocido (0x${(code >>> 0).toString(16)})`;
}
function pngToFmd(pngBase64, dpi = 500) {
  if (!dpfj_create_fmd_from_raw) return null;
  const pngBuf = bufFromBase64(pngBase64);
  let png;
  try {
    png = PNG.sync.read(pngBuf);
  } catch (e) {
    console.error("[fingerprint] Error decodificando PNG:", e.message);
    return null;
  }
  const { width, height } = png;
  const grayPixels = Buffer.alloc(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = png.data[i * 4];
    const g = png.data[i * 4 + 1];
    const b = png.data[i * 4 + 2];
    grayPixels[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  console.log(`[fingerprint] PNG: ${width}x${height} dpi=${dpi} bytes=${grayPixels.length}`);
  const fmdBuf = Buffer.alloc(MAX_FMD_SIZE);
  const sizeBuf = makeSizeBuf(MAX_FMD_SIZE);
  const result = dpfj_create_fmd_from_raw(
    grayPixels,
    grayPixels.length,
    width,
    height,
    dpi,
    DPFJ_POSITION_UNKNOWN,
    0,
    DPFJ_FMD_ANSI_378_2004,
    fmdBuf,
    sizeBuf
  );
  console.log(`[fingerprint] create_fmd_from_raw -> ${dpfjError(result)} fmd_size=${readSizeBuf(sizeBuf)}`);
  if (result === DPFJ_SUCCESS) {
    return fmdBuf.subarray(0, readSizeBuf(sizeBuf));
  }
  return null;
}
function compareFmds(fmd1Bytes, fmd2Bytes) {
  if (!dpfj_compare) return { ok: false, score: null };
  const fmd1 = fmd1Bytes.length ? fmd1Bytes : Buffer.alloc(0);
  const fmd2 = fmd2Bytes.length ? fmd2Bytes : Buffer.alloc(0);
  const scoreBuf = makeSizeBuf(0);
  const result = dpfj_compare(
    DPFJ_FMD_ANSI_378_2004,
    fmd1,
    fmd1.length,
    0,
    DPFJ_FMD_ANSI_378_2004,
    fmd2,
    fmd2.length,
    0,
    scoreBuf
  );
  const score = readSizeBuf(scoreBuf);
  console.log(`[fingerprint] compare: ${dpfjError(result)} score=${score}`);
  if (result === DPFJ_SUCCESS) {
    return { ok: true, score };
  }
  return { ok: false, score: null };
}
function verifyFingerprint(imageBase64, enrolledStudents, dpi = 500) {
  const probeFmd = pngToFmd(imageBase64, dpi);
  if (!probeFmd) {
    return { match: false, error: "No se pudo extraer características de la huella" };
  }
  if (!enrolledStudents || enrolledStudents.length === 0) {
    return { match: false, error: "No hay estudiantes enrolados para comparar" };
  }
  console.log(`[fingerprint] probe FMD: ${probeFmd.length} bytes, comparando con ${enrolledStudents.length} estudiantes`);
  let bestStudent = null;
  let bestScore = 4294967295;
  for (const student of enrolledStudents) {
    if (!student.huellaTemplate) continue;
    let enrolledBytes;
    try {
      enrolledBytes = bufFromBase64(student.huellaTemplate);
    } catch (e) {
      continue;
    }
    console.log(`[fingerprint]   comparando con ${student._doc ? JSON.stringify({ nombres: student.nombres, apellidos: student.apellidos }) : "estudiante"} (template ${enrolledBytes.length} bytes)`);
    const { ok, score } = compareFmds(probeFmd, enrolledBytes);
    if (ok && score < bestScore) {
      bestScore = score;
      bestStudent = student;
      console.log(`[fingerprint]   NUEVO MEJOR: ${bestStudent.nombres} score=${score}`);
    }
  }
  console.log(`[fingerprint] VERIFY RESULT: best=${bestStudent ? bestStudent.nombres + " " + bestStudent.apellidos : "NONE"} score=${bestScore} threshold=${MATCH_THRESHOLD}`);
  if (bestStudent && bestScore <= MATCH_THRESHOLD) {
    return {
      match: true,
      studentId: bestStudent._id,
      nombres: bestStudent.nombres,
      apellidos: bestStudent.apellidos,
      score: bestScore
    };
  }
  return { match: false, bestScore: bestScore !== 4294967295 ? bestScore : null };
}
function toEngineRecord(record) {
  return {
    _id: record.estudianteId,
    nombres: record.nombres,
    apellidos: record.apellidos,
    huellaTemplate: record.template
  };
}
function identificarEstudiante(imageBase64, estudiantesLocales, dpi = 500) {
  const registrosMotor = (estudiantesLocales || []).map(toEngineRecord);
  return verifyFingerprint(imageBase64, registrosMotor, dpi);
}
let docente = null;
let onEstadoChange = null;
function setOnEstadoChange(cb) {
  onEstadoChange = cb;
}
function notificarEstado() {
  if (onEstadoChange) onEstadoChange();
}
async function init() {
  await init$1();
  inicializarCaptura();
  setOnStatusChange(notificarEstado);
  connect(getConfig());
  syncPendientes();
  iniciarRegistroDispositivo(() => {
    connect(getConfig());
    notificarEstado();
  });
}
function getStatus() {
  return {
    online: getConnectionStatus(),
    claseActiva: getClaseActiva() || null,
    dispositivoRegistrado: tieneIdentidad(),
    docente: docente ? {
      correo: docente.correo,
      nombre: docente.nombre,
      esLider: docente.esLider,
      rolDetallado: docente.rolDetallado
    } : null
  };
}
async function capturarYVerificar() {
  const clase = getClaseActiva();
  if (!clase) {
    return { ok: false, error: "No hay clase activa en este dispositivo" };
  }
  let imagen;
  let dpi;
  try {
    const captura = await capturarHuella();
    imagen = captura.imagen;
    dpi = captura.dpi;
  } catch (err) {
    return { ok: false, error: err.message };
  }
  const plantillas2 = await getPlantillasFicha(clase.fichaId);
  return identificarEstudiante(imagen, plantillas2, dpi);
}
async function loginDocente(correo, password) {
  if (!correo || !password) {
    return { ok: false, error: "Ingresa correo y contraseña" };
  }
  const { backendUrl } = getConfig();
  let res;
  try {
    res = await fetch(`${backendUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo, password }),
      signal: AbortSignal.timeout(1e4)
    });
  } catch {
    return { ok: false, error: "Sin conexión: no se puede validar el acceso docente" };
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (res.status === 401) {
    return { ok: false, error: "Correo o contraseña incorrectos" };
  }
  if (res.status === 403) {
    return { ok: false, error: data?.error || "Tu cuenta no puede acceder al modo docente" };
  }
  if (!res.ok || !data?.ok) {
    return { ok: false, error: data?.error || "No se pudo iniciar sesión" };
  }
  const usuario = data.usuario;
  if (!usuario || usuario.rol !== "Instructor") {
    return { ok: false, error: "Solo los instructores pueden acceder al modo docente" };
  }
  docente = {
    id: usuario.id,
    correo: usuario.correo,
    nombre: usuario.nombre,
    rol: usuario.rol,
    esLider: !!usuario.esLider,
    rolDetallado: usuario.rolDetallado || "Instructor"
  };
  return { ok: true, docente: { correo: docente.correo, nombre: docente.nombre } };
}
async function getFichaLider() {
  if (!docente) {
    return { ok: false, error: "No hay sesión docente activa" };
  }
  const { backendUrl } = getConfig();
  let res;
  try {
    res = await fetch(`${backendUrl}/api/fichas/mis-fichas/${docente.id}`, { signal: AbortSignal.timeout(1e4) });
  } catch {
    return { ok: false, error: "Sin conexión: no se puede obtener la ficha" };
  }
  if (!res.ok) {
    return { ok: false, error: "No se pudo obtener la ficha del líder" };
  }
  const fichas = await res.json().catch(() => null);
  const lista = Array.isArray(fichas) ? fichas : [];
  const fichaLider = lista.find((f) => f.esLider) || null;
  if (!fichaLider) {
    return { ok: false, error: "No tienes una ficha asignada como líder" };
  }
  return { ok: true, ficha: fichaLider };
}
async function getEstudiantesFicha(fichaId) {
  if (!fichaId) {
    return { ok: false, error: "Ficha no especificada" };
  }
  const { backendUrl } = getConfig();
  let res;
  try {
    res = await fetch(`${backendUrl}/api/estudiantes?fichaId=${encodeURIComponent(fichaId)}`, { signal: AbortSignal.timeout(1e4) });
  } catch {
    return { ok: false, error: "Sin conexión: no se pueden obtener los estudiantes" };
  }
  if (!res.ok) {
    return { ok: false, error: "No se pudieron obtener los estudiantes" };
  }
  const estudiantes = await res.json().catch(() => null);
  return { ok: true, estudiantes: Array.isArray(estudiantes) ? estudiantes : [] };
}
async function enrolarEstudiante({ estudianteId, fichaId, dedo }) {
  if (!estudianteId || !fichaId) {
    return { ok: false, error: "Selecciona un estudiante" };
  }
  const clase = getClaseActiva();
  if (clase) {
    return { ok: false, error: "Finaliza la clase activa en este dispositivo antes de enrolar" };
  }
  try {
    await capturarHuella();
  } catch (err) {
    return { ok: false, error: err.message };
  }
  return { ok: false, error: "Enrolamiento aún no implementado: falta convertir la imagen en template" };
}
function logoutDocente() {
  docente = null;
  return { ok: true };
}
const __dirname$1 = dirname(fileURLToPath(import.meta.url));
let mainWindow = null;
function broadcastStatus() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("huellero:status", getStatus());
  }
}
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    fullscreen: false,
    autoHideMenuBar: true,
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: join(__dirname$1, "../preload/index.mjs"),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false
    }
  });
  mainWindow.setMenuBarVisibility(false);
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname$1, "../renderer/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
ipcMain.handle("huellero:getStatus", () => getStatus());
ipcMain.handle("huellero:capture", () => capturarYVerificar());
ipcMain.handle("huellero:login", (_e, correo, password) => loginDocente(correo, password));
ipcMain.handle("huellero:logout", () => logoutDocente());
ipcMain.handle("huellero:getFichaLider", () => getFichaLider());
ipcMain.handle("huellero:getEstudiantesFicha", (_e, fichaId) => getEstudiantesFicha(fichaId));
ipcMain.handle("huellero:enrolar", (_e, payload) => enrolarEstudiante(payload));
setOnEstadoChange(broadcastStatus);
app.whenReady().then(async () => {
  createWindow();
  broadcastStatus();
  await init();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
export {
  broadcastStatus
};
