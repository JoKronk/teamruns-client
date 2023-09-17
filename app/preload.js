const { contextBridge, ipcRenderer } = require("electron");
   
const validIpcChannelsIn = [
    "og-start-game",
    "og-start-run",
    "og-command",
    "og-state-read",
    "og-tracker-connected-read",
    "window-close",
    "window-minimize",
    "file-fetch",
    "settings-read",
    "settings-write",
    "settings-select-path",
    "settings-reset-size",
    "update-check",
    "update-install"
];
const validIpcChannelsOut = [
    "og-task-update",
    "og-tracker-connected",
    "backend-message",
    "backend-error",
    "file-get",
    "settings-get",
    "settings-get-path",
    "update-available",
    "update-progress",
    "update-downloaded"
];


contextBridge.exposeInMainWorld("electron", {
    send: (channel, data) => {
        if (validIpcChannelsIn.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    receive: (channel, func) => {
        if (validIpcChannelsOut.includes(channel)) {
            const subscription = (event, ...args) => func(...args);
            // Deliberately strip event as it includes `sender` 
            ipcRenderer.on(channel, subscription);
            return () => {
                ipcRenderer.removeListener(channel, subscription);
            };
        }
    }
});
    