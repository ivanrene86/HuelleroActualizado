import { ipcMain, app, BrowserWindow } from "electron";
import path, { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { existsSync, readFileSync } from "fs";
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
  backendUrl: "http://localhost:4000",
  wsUrl: "ws://localhost:4000"
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
let estado = {
  claseActiva: null
};
async function init$1() {
  estado.claseActiva = null;
}
function getClaseActiva() {
  return estado.claseActiva;
}
async function getPlantillasFicha(fichaId) {
  return [];
}
function getPendientes() {
  return [];
}
let online = false;
function connect(config) {
  online = false;
}
function getConnectionStatus() {
  return online;
}
async function capturarHuella() {
  return null;
}
async function syncPendientes() {
  const pendientes = getPendientes();
  return { procesados: pendientes.length, ok: true };
}
const __dirname$2 = path.dirname(fileURLToPath(import.meta.url));
const dllFolder = path.resolve(__dirname$2, "../dll");
process.env.PATH = `${dllFolder};${process.env.PATH}`;
const DPFJ_SUCCESS = 0;
const DPFJ_FMD_ANSI_378_2004 = 1769473;
const DPFJ_POSITION_UNKNOWN = 0;
let MAX_FMD_SIZE = 26 + 4 + 255 * 6 + 2;
const MATCH_THRESHOLD = 1073741823;
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
function pngToFmd(pngBase64) {
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
  console.log(`[fingerprint] PNG: ${width}x${height} dpi=500 bytes=${grayPixels.length}`);
  const fmdBuf = Buffer.alloc(MAX_FMD_SIZE);
  const sizeBuf = makeSizeBuf(MAX_FMD_SIZE);
  const result = dpfj_create_fmd_from_raw(
    grayPixels,
    grayPixels.length,
    width,
    height,
    500,
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
function verifyFingerprint(imageBase64, enrolledStudents) {
  const probeFmd = pngToFmd(imageBase64);
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
function identificarEstudiante(imageBase64, estudiantesLocales) {
  const registrosMotor = (estudiantesLocales || []).map(toEngineRecord);
  return verifyFingerprint(imageBase64, registrosMotor);
}
let docente = null;
async function init() {
  getConfig();
  await init$1();
  connect();
  syncPendientes();
}
function getStatus() {
  return {
    online: getConnectionStatus(),
    claseActiva: getClaseActiva() || null,
    docente: docente ? { usuario: docente.usuario, nombre: docente.nombre } : null
  };
}
async function capturarYVerificar() {
  const clase = getClaseActiva();
  if (!clase) {
    return { ok: false, error: "No hay clase activa en este dispositivo" };
  }
  const imagen = await capturarHuella();
  if (!imagen) {
    return { ok: false, error: "Captura de huella no disponible aún" };
  }
  const plantillas = await getPlantillasFicha(clase.fichaId);
  return identificarEstudiante(imagen, plantillas);
}
async function loginDocente(usuario, password) {
  if (!usuario || !password) {
    return { ok: false, error: "Ingresa usuario y contraseña" };
  }
  docente = { usuario, nombre: usuario };
  return { ok: true, docente: { usuario, nombre: usuario } };
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
ipcMain.handle("huellero:login", (_e, usuario, password) => loginDocente(usuario, password));
ipcMain.handle("huellero:logout", () => logoutDocente());
app.whenReady().then(async () => {
  await init();
  createWindow();
  broadcastStatus();
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
