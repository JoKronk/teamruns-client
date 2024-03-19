const { app, BrowserWindow, ipcMain, dialog, screen, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const url = require('url');
const fs = require('fs');
const child_process = require('child_process');
const axios = require('axios');
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
        backgroundThrottling: false,
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
    
  ipcMain.on('settings-select-path', (event, forIso) => {
    if (forIso)
      selectIsoPath();
    else
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
    
  ipcMain.on('install-check', () => {
    checkInstallUpToDate();
  });
    
  ipcMain.on('install-start', (event, isoPath) => {
    installGame(isoPath);
  });
    
  ipcMain.on('install-update', () => {
    installGame();
  });
    
  ipcMain.on('update-check', () => {
    autoUpdater.checkForUpdatesAndNotify();
  });
    
  ipcMain.on('update-start', () => {
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
      
      if (!user.ogFolderpath) {
        user.ogFolderpath = getInstallPath();
        writeSettings(user);
      }

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

      setTimeout(() => { //timeout to give client update to be check first
        checkInstallUpToDate();
      }, 1000);
    }
  });
}


// --- RECORDINGS ---
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
    
  child_process.exec('start "" ' + recPath);
}

function readFile(filepath) {
  fs.readFile(filepath, 'utf8', function (err, data) {
    if (err) console.log(err)
    else if (data) win.webContents.send("file-get", JSON.parse(data));
  });
}


// --- OPENGOAL INSTALLATION ---
function getInstallPath() {
  return userSettings.ogFolderpath ?? path.join(app.getPath('userData'), "tr-project");
}

function selectFolderPath() {
  dialog.showOpenDialog({title: 'Select location for project folder', properties: ['openDirectory']}).then(result => {
    let folderPath = result.filePaths[0];
    if (folderPath !== undefined)
      win.webContents.send("settings-get-path", folderPath);
  });
}

function selectIsoPath() {
  dialog.showOpenDialog({title: 'Select ISO file', properties: ['openFile'], filters: [{ name: 'ISO', extensions: ['iso'] }]}).then(result => {
    let isoFile = result.filePaths[0];
    if (isoFile !== undefined && isoFile.endsWith(".iso"))
      win.webContents.send("settings-get-path", isoFile);
    else
      sendClientMessage("Something went wrong fetching the ISO path.");
  });
}

async function checkGameIsInstalled() {
  const folderPath = getInstallPath();
  if (!fs.existsSync(folderPath) || !fs.existsSync(path.join(folderPath, "extractor.exe")) || !fs.existsSync(path.join(folderPath, "gk.exe")) || !fs.existsSync(path.join(folderPath, "goalc.exe")))
    return false;

  const isoPath = path.join(folderPath, "data", "iso_data", "jak1");
  if (!fs.existsSync(isoPath))
    return !app.isPackaged && fs.existsSync(path.join(folderPath, "goalc-simple.exe"));

  const files = await fs.promises.readdir(isoPath);
  return files.length > 1 && userSettings.gameVersion;
}

async function getLatestGameReleaseVersion() {
  const response = await axios.get("https://api.github.com/repos/open-goal/jak-project/tags", { headers: { 'User-Agent': 'Teamruns' } });

  return tag = response.data.sort(function (a, b) {
    return ('' + b.name).localeCompare(a.name);
    })[0].name.substring(1);
}

async function checkInstallUpToDate() {
  if (!await checkGameIsInstalled()) {
    win.webContents.send("install-missing");
    return;
  }
  else
    win.webContents.send("install-found");
  
  if (await getLatestGameReleaseVersion() !== userSettings.gameVersion)
    win.webContents.send("install-outdated");
}

function writeInstallVersionToSetting(version) {
  userSettings.gameVersion = version;
  writeSettings(userSettings);
}

function sendInstallProgress(progress, message) {
  win.webContents.send("install-progress", { progress: progress, message: message });
}

async function cleanGameInstallLocation() {
  let folderPath = getInstallPath();
  
  const dataPath = path.join(folderPath, "data");
  if (!fs.existsSync(dataPath))
    return;
  
  //exe files
  for(const file of (await fs.promises.readdir(folderPath))) {
    const entryPath = path.join( folderPath, file );
    const stat = await fs.promises.stat( entryPath );

    if(stat.isFile())
      await fs.promises.unlink(entryPath);
  }
  
  //data folder
  for(const file of (await fs.promises.readdir(dataPath))) {
    if (file.includes("iso_data"))
      continue;

    const entryPath = path.join( dataPath, file );
    const stat = await fs.promises.stat( entryPath );

    if(stat.isFile())
      await fs.promises.unlink(entryPath);
    else if(stat.isDirectory())
      await fs.promises.rm(entryPath, { recursive: true });
  }
}

//runs update if isoPath is null
async function installGame(isoPath) { //downloads and unzips project, then calls extractISO
  var yauzl = require('yauzl');
  var mkdirp = require('mkdirp');

  await cleanGameInstallLocation();

  sendInstallProgress(1, "Fetching game version");
  const version = await getLatestGameReleaseVersion();
  sendInstallProgress(3, "Downloading release");
  const response = await axios.get("https://github.com/open-goal/jak-project/releases/latest/download/opengoal-windows-v" + version + ".zip", { responseType: 'arraybuffer' });
  
  sendInstallProgress(5, "Unzipping");
  let folderPath = getInstallPath();
  yauzl.fromBuffer(response.data, { lazyEntries: true }, function(err, zipFile) {
    if (err) throw err;

    const entryTotalCount = zipFile.entryCount;
    let entryProgress = 0;

    zipFile.readEntry();
    zipFile.on("entry", function(entry) {

      if (/\/$/.test(entry.fileName)) {
        // Directory
        mkdirp.sync(path.join(folderPath, entry.fileName));
        zipFile.readEntry();
      } 
      else {
        // File
        zipFile.openReadStream(entry, function(err, readStream) {
          if (err) throw err;
          const file = fs.createWriteStream(path.join(folderPath, entry.fileName));
          readStream.pipe(file);

          file.on('finish', () => {
            // Wait until the file is finished writing, then read the next entry.
            file.close(() => {
              entryProgress += 1;
              // progress / total count * part of 100% this step count as + already
              sendInstallProgress((entryProgress / entryTotalCount * 15 + 5), "Unzipping");
              zipFile.readEntry();
            });

            file.on('error', (err) => { zipFile.close(); });
          });
        });
      }
    });

    
    zipFile.on("end", function () {
      extractISO(version, isoPath);
    });
  });
}

function extractISO(version, isoPath) {
  const folderPath = getInstallPath();
  let extractProgress = 0;
  const extractTotal = 377; //counted from extaction
  let decompProgress = 0;
  const decompTotal = 24; //counted from decompiling
  let compiling = false;

  let extractor = isoPath ? child_process.spawn(path.join(folderPath, "extractor"), ['-e', '-d', '-c', isoPath])
  : child_process.spawn(path.join(folderPath, "extractor"), ['-d', '-c', '-f', path.join(folderPath, "data", "iso_data", "jak1")]);

  //On start
  extractor.on('spawn', () => {
});

  //On data
  extractor.stdout.on('data', (data) => {
      //remove ansi color coding
      let msg = data.toString().replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
      if (msg.length > 8)
        msg = msg.slice(8);

      if (!compiling) {
        if (msg.includes("0%] [copy"))
          compiling = true;
        else if (msg.startsWith("[info] Extracting")) {
          msg = msg.slice(7);
          extractProgress += 1;
          sendInstallProgress((extractProgress / extractTotal * 15 + 20), msg);
        }
        else if (msg.startsWith("[info] stats for")) {
          decompProgress += 1;
          sendInstallProgress((decompProgress / decompTotal * 15 + (isoPath ? 35 : 20)), "Decompiling");
        }
      }
      else {
        let progress = msg.match(/\d+% ?/g);
        if (progress) {
          sendInstallProgress((progress[0].slice(0, -1) / 100 * (isoPath ? 50 : 65) + (isoPath ? 50 : 35)), "Compiling");
        }
      }
  });

  //On error
  extractor.stderr.on('data', (data) => {
      const msg = data.toString();
      console.log(msg);
  });

  //On kill
  extractor.stdout.on('end', () => {
    sendInstallProgress(100, ".done");
    writeInstallVersionToSetting(version);
  });
}

// --- FRONTEND COMMUNICATION ---
function sendClientMessage(msg) {
  win.webContents.send("backend-message", msg);
}