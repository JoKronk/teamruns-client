const { contextBridge, ipcRenderer } = require("electron");
   
const validIpcChannelsIn = [
    "og-start-repl",
    "og-start-game",
    "og-close-game",
    "og-command",
    "window-close",
    "window-minimize",
    "settings-read",
    "settings-write",
    "settings-select-path",
    "settings-reset-size",
    "recordings-download",
    "recordings-fetch",
    "recordings-write",
    "recordings-open",
    "save-fetch",
    "save-write",
    "save-open",
    "logs-fetch",
    "update-check",
    "update-start",
    "install-check",
    "install-start",
    "install-update"
];
const validIpcChannelsOut = [
    "og-launched",
    "og-closed",
    "backend-message",
    "backend-error",
    "settings-get",
    "settings-get-path",
    "recordings-download-get",
    "recordings-fetch-get",
    "save-get",
    "logs-get",
    "update-available",
    "update-progress",
    "update-downloaded",
    "install-missing",
    "install-found",
    "install-outdated",
    "install-progress",
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
    