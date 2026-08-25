import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("huellero", {
  getStatus: () => ipcRenderer.invoke("huellero:getStatus"),
  capturarYVerificar: () => ipcRenderer.invoke("huellero:capture"),
  loginDocente: (usuario, password) => ipcRenderer.invoke("huellero:login", usuario, password),
  logoutDocente: () => ipcRenderer.invoke("huellero:logout"),
  onStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("huellero:status", listener);
    return () => ipcRenderer.removeListener("huellero:status", listener);
  }
});
