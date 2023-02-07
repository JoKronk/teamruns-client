const { contextBridge, ipcRenderer } = require("electron");
   
const validIpcMessageChannels = ["og-start-game", "og-start-run", "og-command", "window-close"];


contextBridge.exposeInMainWorld("electron", {
    send: (channel, data) => {
        console.log("channel: ", channel);
        console.log("data: ", data);
        
        if (validIpcMessageChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    }
    }
);
    