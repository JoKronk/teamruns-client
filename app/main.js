const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');
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
  openGoal.readGameState();
    
// --- FRONTEND COM ---
  ipcMain.on('og-start-game', () => {
    sendClientMessage("Got to backend!");
    openGoal.runGameSetup();
  });

  ipcMain.on('og-start-run', () => {
    openGoal.writeGoalCommand("(progress-fast-save-and-start-speedrun (speedrun-category full-game))");
  });

  ipcMain.on('og-command', (event, command) => {
    openGoal.writeGoalCommand(command);
  });

  ipcMain.on('og-state-read', () => {
    openGoal.sendClientStateUpdate();
  });

  ipcMain.on('og-tracker-connected-read', () => {
    openGoal.sendClientTrackerState();
  });

  ipcMain.on('settings-write', (event, settings) => {
    writeSettings(settings);
  });
    
  ipcMain.on('settings-read', () => {
    readSettings();
  });
    
  ipcMain.on('settings-select-path', () => {
    selectFolderPath();
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


// --- SETTINGS ---
function writeSettings(settings) {
  fs.writeFile('./settings.json', JSON.stringify(settings), (err) => {
    if (err) sendClientMessage("Failed to update user data!");
  });
}

function readSettings() {
  fs.readFile("./settings.json", 'utf8', function (err, data) {
    err ? console.log(err) : win.webContents.send("settings-get", JSON.parse(data));
  });
}

function selectFolderPath() {
  dialog.showOpenDialog({title: 'Select a folder', properties: ['openDirectory']}).then(result => {
    if (result.filePaths[0] !== undefined)
      win.webContents.send("settings-get-path", result.filePaths[0]);
  });
}

// --- FRONTEND COMMUNICATION ---
function sendClientMessage(msg) {
  win.webContents.send("backend-message", msg);
}