const { app, BrowserWindow, ipcMain, dialog, screen, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const url = require('url');
const fs = require('fs');
const { OpenGoal } = require('./opengoal');
	
let win = null;
const runRepl = false;
const devServe = (process.argv.at(-1) === '--serve');
var openGoal;
var userSettings = { window: { x: 10, y: 10, width: 1000, height: 800 } };

function createWindow() {  
       
// --- CONFIGS ---
  let factor = screen.getPrimaryDisplay().scaleFactor;
	win = new BrowserWindow({
    width: userSettings.window.width / factor, 
    height: userSettings.window.height / factor,
    minWidth: 850 / factor,
    minHeight: 670 / factor,
    maxWidth: 1165 / factor,
    maxHeight: 1100 / factor,
    x: userSettings.window.x,
    y: userSettings.window.y,
    webPreferences: {
        zoomFactor: 1.0 / factor,
        allowRunningInsecureContent: (devServe),
        preload: path.join(__dirname, "preload.js")
    },
    titleBarOverlay: {
      color: 'rgba(0, 0, 0, 0)',
      symbolColor: '#74b1be',
      height: 30
    },
    autoHideMenuBar: true,
    resizable: true,
    fullscreenable: false,
    transparent: true,
    frame: false
  });


  if (devServe) {
    const debug = require('electron-debug');
    debug();
    require('electron-reloader')(module);

    win.loadURL('http://localhost:4200');
    win.webContents.openDevTools({mode: "detach"});
  } 
  else {
    win.loadURL(url.format({      
        pathname: path.join( __dirname, 'teamrun-client/index.html'),       
        protocol: 'file:',      
        slashes: true
    }));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  openGoal = new OpenGoal(win, runRepl);

  win.on('resized', () => {
    const size = win.getSize();
    userSettings.window.width  = size[0];
    userSettings.window.height = size[1];
    writeSettings(userSettings);
  });

  win.on('moved', () => {
    const pos = win.getPosition();
    userSettings.window.x  = pos[0];
    userSettings.window.y = pos[1];
    writeSettings(userSettings);
  });
    
// --- FRONTEND COM ---
  ipcMain.on('og-start-repl', () => {
    openGoal.preStartREPL();
  });

  ipcMain.on('og-start-game', (event, port) => {
    openGoal.startOG(port);
  });

  ipcMain.on('og-close-game', (event, port) => {
    openGoal.killGK(port);
  });

  ipcMain.on('og-command', (event, command) => {
    openGoal.writeGoalCommand(command);
  });

  ipcMain.on('file-fetch', (event, filepath) => {
    readFile(filepath);
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
    
  ipcMain.on('settings-reset-size', () => {
    win.setSize(1000, 800);
    win.setPosition(10, 10);
    userSettings.window.width  = 1000;
    userSettings.window.height = 800;
    userSettings.window.x  = 10;
    userSettings.window.y = 10;
  });

  ipcMain.on('recordings-write', (event, recordings) => {
    writeRecordings(recordings);
  });

  ipcMain.on('recordings-open', () => {
    openRecordings();
  });
    
  ipcMain.on('window-minimize', () => {
    win.minimize();
  });
    
  ipcMain.on('window-close', () => {
    openGoal.killAllOgInstances();
    win.close();
  });
    
  ipcMain.on('update-check', () => {
    autoUpdater.checkForUpdatesAndNotify();
  });
    
  ipcMain.on('update-install', () => {
    openGoal.killAllOgInstances();
    autoUpdater.quitAndInstall();
  });

  // --- AUTO UPDATE LISTENERS ---
  autoUpdater.on('update-available', () => {
    win.webContents.send('update-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    win.webContents.send('update-progress', progress.percent);
  });
  
  autoUpdater.on('update-downloaded', () => {
    win.webContents.send('update-downloaded');
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
  settings.window = userSettings.window;
  userSettings = settings;
  fs.writeFile(path.join(app.getPath('userData'), 'settings.json'), JSON.stringify(settings), (err) => {
    if (err) sendClientMessage("Failed to update user data!");
  });
}

function readSettings() {
  fs.readFile(path.join(app.getPath('userData'), 'settings.json'), 'utf8', function (err, data) {
    if (err) console.log(err)
    else if (data) {
      const user = JSON.parse(data);
      win.webContents.send("settings-get", user);
    
      if (user.window) {
        if (user.window.width && user.window.height && (user.window.width !== userSettings.window.width || user.window.height !== userSettings.window.height))
          win.setSize(user.window.width, user.window.height);
        if (user.window.x && user.window.y && (user.window.x !== userSettings.window.x || user.window.y !== userSettings.window.y))
          win.setPosition(user.window.x, user.window.y);
      }
      else
      user.window = userSettings.window;
      
      userSettings = user;
    }
  });
}

function getRecordingsPath() {
  const recPath = path.join(app.getPath('documents'), "Teamruns", "Recordings");
  if (!fs.existsSync(recPath))
    fs.mkdirSync(recPath, { recursive: true });
  
  return recPath;
}

function writeRecordings(recordings) {
  const folderPath = path.join(getRecordingsPath(), new Date().toISOString().split(".")[0].replace(/[T:]/g, '-').slice(0, -3));
  if (!fs.existsSync(folderPath))
    fs.mkdirSync(folderPath, { recursive: true });

  recordings.forEach(recording => {
    recording.userId = undefined;
    fs.writeFile(path.join(folderPath, recording.displayName + ".json"), JSON.stringify(recording), (err) => {
      if (err) sendClientMessage(err.message);
    });
  });
}

function openRecordings() {
  const recPath = getRecordingsPath();
  if (!fs.existsSync(recPath))
    fs.mkdirSync(recPath, { recursive: true });
    
  require('child_process').exec('start "" ' + recPath);
}

function readFile(filepath) {
  fs.readFile(filepath, 'utf8', function (err, data) {
    if (err) console.log(err)
    else if (data) win.webContents.send("file-get", JSON.parse(data));
  });
}

function selectFolderPath() {
  dialog.showOpenDialog({title: 'Select a folder', properties: ['openFile'], filters: [{ name: 'Executables', extensions: ['exe'] },{ name: 'All Types', extensions: ['*'] }]}).then(result => {
    let file = result.filePaths[0];
    if (file !== undefined && file.endsWith("gk.exe") && file.length > 6 && fs.existsSync(file.slice(0, -6) + "goalc.exe"))
      win.webContents.send("settings-get-path", file.slice(0, -7));
    else
      sendClientMessage("File does not seem to be OpenGoal gk.exe!");
  });
}

// --- FRONTEND COMMUNICATION ---
function sendClientMessage(msg) {
  win.webContents.send("backend-message", msg);
}