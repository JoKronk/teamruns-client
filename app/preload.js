const { contextBridge, ipcRenderer } = require("electron");
   
const validIpcChannelsIn = ["og-start-game", "og-start-run", "og-command", "window-close", "settings-read", "settings-write", "settings-select-path"];
const validIpcChannelsOut = ["og-task-update", "og-state-update", "backend-message", "backend-error", "settings-get", "settings-get-path"];


contextBridge.exposeInMainWorld("electron", {
    send: (channel, data) => {
        if (validIpcChannelsIn.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    receive: (channel, func) => {
        if (validIpcChannelsOut.includes(channel)) {
            // Deliberately strip event as it includes `sender` 
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    }
});
    