const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const { OpenGoal } = require('./opengoal');
	
let win = null;
const devServe = (process.argv.at(-1) === '--serve');
var openGoal;

function createWindow() {  
       
// --- CONFIGS ---
	win = new BrowserWindow({
    width: 1000, 
    height: 800,
    x: 10,
    y: 10,
    webPreferences: {
        allowRunningInsecureContent: (devServe),
        preload: path.join(__dirname, "preload.js")
    },
    titleBarOverlay: {
      color: 'rgba(0, 0, 0, 0)',
      symbolColor: '#74b1be',
      height: 30
    },
    autoHideMenuBar: true,
    resizable: false,
    titleBarStyle: 'hidden',
    fullscreenable: false,
    transparent: true,
    frame: false
  });



  if (devServe) {
    const debug = require('electron-debug');
    debug();
    require('electron-reloader')(module);

    win.loadURL('http://localhost:4200');
    win.webContents.openDevTools();
  } 
  else {
    win.loadURL(url.format({      
        pathname: path.join( __dirname, 'teamrun-client/index.html'),       
        protocol: 'file:',      
        slashes: true
    }));
  }

  openGoal = new OpenGoal(win);
    
// --- FRONTEND COM ---
  ipcMain.on('og-start-game', (event, command) => {
    sendClientMessage("Got to backend!");
    openGoal.runGameSetup();
  });

  ipcMain.on('og-start-run', (event, command) => {
    openGoal.writeGoalCommand("(progress-fast-save-and-start-speedrun (speedrun-category full-game))");
  });

  ipcMain.on('og-command', (event, command) => {
    openGoal.writeGoalCommand(command);
  });
    
  ipcMain.on('window-close', () => {
    win = null;
  });

    return win;
} 

// --- ELECTRON LISTENERS ---
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their 
    // menu bar to stay active until the user quits 
    // explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
  
app.on('activate', () => {
    // On macOS it's common to re-create a window in the 
    // app when the dock icon is clicked and there are no 
    // other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})


// --- FRONTEND COMMUNICATION ---
function sendClientSettings(settings) {
  win.webContents.send("setting-get", settings);
}

function sendClientMessage(msg) {
  win.webContents.send("backend-message", msg);
}