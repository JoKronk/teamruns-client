const { contextBridge, ipcRenderer } = require("electron");
   
const validIpcChannelsIn = ["og-start-game", "og-start-run", "og-command", "og-state-read", "og-task-status-read", "og-tracker-connected-read", "window-close", "window-minimize", "settings-read", "settings-write", "settings-select-path"];
const validIpcChannelsOut = ["og-task-update", "og-state-update", "og-task-status-update", "og-tracker-connected", "backend-message", "backend-error", "settings-get", "settings-get-path"];


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
    