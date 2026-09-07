import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("huellero", {
  getStatus: () => ipcRenderer.invoke("huellero:getStatus"),
  capturarYVerificar: () => ipcRenderer.invoke("huellero:capture"),
  loginDocente: (correo, password) => ipcRenderer.invoke("huellero:login", correo, password),
  logoutDocente: () => ipcRenderer.invoke("huellero:logout"),
  getFichaLider: () => ipcRenderer.invoke("huellero:getFichaLider"),
  getEstudiantesFicha: (fichaId) => ipcRenderer.invoke("huellero:getEstudiantesFicha", fichaId),
  enrolarEstudiante: (payload) => ipcRenderer.invoke("huellero:enrolar", payload),
  onStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("huellero:status", listener);
    return () => ipcRenderer.removeListener("huellero:status", listener);
  }
});
