const { app, BrowserWindow, ipcMain, dialog, screen, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const url = require('url');
const fs = require('fs');
const tar = require('tar');
const child_process = require('child_process');
const axios = require('axios');
const yauzl = require('yauzl');
const mkdirp = require('mkdirp');
const pjson = require('./package.json');
const { OpenGoal } = require('./opengoal');
const spawn = require('child_process').spawn;
	
let win = null;
const runRepl = false;
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
        allowRunningInsecureContent: (!app.isPackaged),
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
    frame: false,
    icon: "./../src/assets/icon.png"
  });

  if (!app.isPackaged) {
    const debug = require('electron-debug');
    debug();
    require('electron-reloader')(module);

    win.loadURL('http://localhost:4200');
  } 
  else {
    win.loadURL(url.format({      
        pathname: path.join( __dirname, 'teamruns-client/index.html'),       
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

  ipcMain.on('recordings-download', (event, url) => {
    downloadRecording(url);
  });

  ipcMain.on('recordings-fetch', (event, filepath) => {
    readFile(filepath);
  });

  ipcMain.on('recordings-write', (event, recordings) => {
    writeRecordings(recordings);
  });

  ipcMain.on('recordings-open', () => {
    openFolder(getRecordingsPath());
  });

  ipcMain.on('splits-fetch', () => {
    readSplitsFile();
  });

  ipcMain.on('splits-write', (event, splits) => {
    writeSplits(splits);
  });

  ipcMain.on('taunts-fetch', () => {
    readTauntsFile();
  });

  ipcMain.on('taunts-write', (event, taunts) => {
    writeTaunts(taunts);
  });

  ipcMain.on('save-fetch', () => {
    readSaveFiles();
  });

  ipcMain.on('save-write', (event, saveFile) => {
    writeSave(saveFile);
  });

  ipcMain.on('save-open', () => {
    openFolder(getSaveFilesPath());
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
    
  ipcMain.on('install-start', (event, install) => {
    installGame(install.url, install.isoPath, install.version);
  });
    
  ipcMain.on('update-check', () => {
    if (app.isPackaged)
      checkClientUpToDate();
  });
    
  ipcMain.on('update-start', () => {
    if (clientIsPortable())
      downloadPortable(undefined);
    else
      autoUpdater.checkForUpdates();
  });
    
  ipcMain.on('download-portable', (event, version) => {
      downloadPortable(version);
  });

  // --- AUTO UPDATE LISTENERS ---
  autoUpdater.on('download-progress', (progress) => {
    win.webContents.send('update-progress', progress.percent);
  });
  
  autoUpdater.on('update-downloaded', () => {
    openGoal.killAllOgInstances();
    autoUpdater.quitAndInstall();
  });

  
  if (!app.isPackaged)
    win.webContents.openDevTools({mode: "detach"});

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
async function writeSettings(settings) {
  settings.window = userSettings.window;
  userSettings = settings;
  await fs.promises.writeFile(path.join(app.getPath('userData'), 'settings.json'), JSON.stringify(settings), (err) => {
    if (err) sendClientMessage("Failed to update user data!");
  });
}

function readSettings() {
  let settingsPath = path.join(app.getPath('userData'), 'settings.json');
  if (!fs.existsSync(settingsPath))
    onUserSettingsRead("{}");
  else {
    fs.readFile(path.join(app.getPath('userData'), 'settings.json'), 'utf8', function (err, data) {
      if (err) console.log(err)
      else if (data) 
        onUserSettingsRead(data);
    });
  }
}

function onUserSettingsRead(data) {
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

function isWindows() {
  return process.platform === "win32";
}

function isLinux() {
  return process.platform === "linux";
}

function isSupportedPlatform() {
  return isWindows() || isLinux();
}


// --- RECORDINGS ---
function getRecordingsPath() {
  const recPath = path.join(app.getPath('documents'), "Teamruns", "Recordings");
  if (!fs.existsSync(recPath))
    fs.mkdirSync(recPath, { recursive: true });
  
  return recPath;
}

function writeRecordings(recordings) {
  if (!recordings) return;
  const folderPath = getRecordingsPath();
  const fileName = new Date().toISOString().replace("T", "_").split(".")[0].replace(/[:]/g, '-').slice(0, -3);

  recordings.forEach((recording, index) => {
    fs.writeFile(path.join(folderPath, (recordings.length === 1 ? fileName : (fileName + "_" + (index + 1))) + ".json"), JSON.stringify(recording), (err) => {
      if (err) sendClientMessage(err.message);
    });
  });
}

function openFolder(path) {
  if (!fs.existsSync(path))
    fs.mkdirSync(path, { recursive: true });
  
    shell.openPath(path);
}

function readFile(filepath) {
  fs.readFile(filepath, 'utf8', function (err, data) {
    if (err) console.log(err)
    else if (data) win.webContents.send("recordings-fetch-get", JSON.parse(data));
  });
}

async function downloadRecording(url) {
  if (!url.startsWith("https://firebasestorage.googleapis.com/")) return;
  
  try {
    const response = (await axios.get(url));
    if (response.data)
      win.webContents.send("recordings-download-get", response.data);
    else
      sendClientMessage("Failed to fetch recording.");
  }
  catch (error) {
    sendClientMessage("Failed to fetch recording.");
  }
}


// --- SPLITS ---
function getSplitsPath() {
  const splitsPath = path.join(app.getPath('documents'), "Teamruns");
  if (!fs.existsSync(splitsPath))
    fs.mkdirSync(splitsPath, { recursive: true });
  
  return splitsPath;
}

function writeSplits(splits) {
  if (!splits) return;
  const folderPath = getSplitsPath();
  fs.writeFile(path.join(folderPath, "splits.json"), JSON.stringify(splits), (err) => {
    if (err) sendClientMessage(err.message);
  });
}

function readSplitsFile() {
  fs.readFile(path.join(getSplitsPath(), "splits.json"), 'utf8', function (err, data) {
    if (err) win.webContents.send("splits-get", null)
    else if (data) win.webContents.send("splits-get", JSON.parse(data));
  });
}

// --- TAUNTS ---
function getTauntsPath() {
  const tauntsPath = path.join(app.getPath('documents'), "Teamruns");
  if (!fs.existsSync(tauntsPath))
    fs.mkdirSync(tauntsPath, { recursive: true });
  
  return tauntsPath;
}

function writeTaunts(taunts) {
  if (!taunts) return;
  const folderPath = getTauntsPath();
  fs.writeFile(path.join(folderPath, "taunts.json"), JSON.stringify(taunts), (err) => {
    if (err) sendClientMessage(err.message);
  });
  // also write to install path for compiler
  fs.writeFile(path.join(getInstallPath(), "data/custom_assets/jak1/taunts", "taunts.json"), JSON.stringify(taunts), (err) => {
    if (err) sendClientMessage(err.message);
  });
  // recompile taunt file to apply changes game-side
  spawn(path.join(getInstallPath(), "goalc"), ["--cmd", "(asm-data-file taunt-info \"custom_assets/jak1/taunts/taunts.json\")"],
    {detached: true, shell: false, stdio: [ 'ignore', 'pipe', 'ignore']})
    .on('exit', code => {if (code != 0) {sendClientMessage("Error generating taunt file!")}});
}

function readTauntsFile() {
  fs.readFile(path.join(getTauntsPath(), "taunts.json"), 'utf8', function (err, data) {
    if (err) win.webContents.send("taunts-get", null)
    else if (data) win.webContents.send("taunts-get", JSON.parse(data));
  });
}

// --- SAVE FILES ---
function getSaveFilesPath() {
  const recPath = path.join(app.getPath('documents'), "Teamruns", "Saves");
  if (!fs.existsSync(recPath))
    fs.mkdirSync(recPath, { recursive: true });
  
  return recPath;
}

function writeSave(save) {
  const folderPath = getSaveFilesPath();
  fs.writeFile(path.join(folderPath, save.name + ".json"), JSON.stringify(save), (err) => {
    if (err) sendClientMessage(err.message);
    else {
      sendClientMessage("Game saved.");
      readSaveFiles();
    }
  });
}

async function readSaveFiles() {
  let saveFiles = [];
  const savesPath = getSaveFilesPath();

  for(const file of (await fs.promises.readdir(savesPath))) {
    const entryPath = path.join( savesPath, file );
    const stat = await fs.promises.stat( entryPath );

    if(stat.isFile() && entryPath.endsWith(".json"))
      saveFiles.push(JSON.parse(await fs.promises.readFile(entryPath, 'utf8')));
  }

  win.webContents.send("save-get", saveFiles);
}


// --- CLIENT UPDATES ---
function clientIsPortable() {
  return process.env.PORTABLE_EXECUTABLE_DIR !== undefined && process.env.PORTABLE_EXECUTABLE_DIR !== null;
}

async function checkClientUpToDate() {
  if (await getLatestClientReleaseVersion() !== pjson.version)
    win.webContents.send('update-available');
}

async function getLatestClientReleaseVersion() {
  const response = await axios.get("https://api.github.com/repos/JoKronk/teamruns-client/releases", { headers: { 'User-Agent': 'Teamruns' } });
  return response.data.length !== 0 ? response.data[0].name.substring(1) : "";
}

async function downloadPortable(selectedVersion) {
  sendInstallProgress(1, "Downloading portable");
  if (!app.isPackaged && selectedVersion === undefined) {
    sendInstallProgress(100, ".done");
    return;
  }
  
  const version = selectedVersion ?? await getLatestClientReleaseVersion();
  const name = "teamruns-client-" + version + "-portable.exe";
  const response = await axios({
    method: "GET",
    url: "https://github.com/JoKronk/teamruns-client/releases/download/v" + version + "/" + name,
    responseType: "stream"
  });
  sendInstallProgress(50, "Saving portable");
  const filePath = path.join(version !== undefined ? app.getPath('downloads') : process.env.PORTABLE_EXECUTABLE_DIR, name);
  response.data.pipe(fs.createWriteStream(filePath));

  return new Promise((resolve, reject) => {
    response.data.on('end', () => {
      sendInstallProgress(100, ".done");
      shell.showItemInFolder(filePath);
      resolve();
      setTimeout(() => {
        sendClientMessage(version !== undefined ? "New client downloaded to downloads folder, closing client." : "New client downloaded to current clients location, closing client.");
        setTimeout(() => {
          openGoal.killAllOgInstances();
          win.close();
        }, 6500);
      }, 3500);
    });

    response.data.on('error', () => {
      sendInstallProgress(100, "Failed to save new executable");
      reject();
    });
  });
}


// --- OPENGOAL INSTALLATION ---
function getInstallPath() {
  const installPath = userSettings.ogFolderpath ?? path.join(app.getPath('documents'), "Teamruns", "jak-project");
  if (!fs.existsSync(installPath))
    fs.mkdirSync(installPath, { recursive: true });

  return installPath;
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
  if (!isSupportedPlatform())
    return;

  const folderPath = getInstallPath();
  
  if (!fs.existsSync(folderPath))
    return false;

  if (isWindows() && (!fs.existsSync(path.join(folderPath, "extractor.exe")) || !fs.existsSync(path.join(folderPath, "gk.exe")) || !fs.existsSync(path.join(folderPath, "goalc.exe"))))
    return false;
  else if (isLinux() && app.isPackaged && (!fs.existsSync(path.join(folderPath, "extractor")) || !fs.existsSync(path.join(folderPath, "gk")) || !fs.existsSync(path.join(folderPath, "goalc"))))
    return false;


  const isoPath = path.join(folderPath, "data", "iso_data", "jak1");
  if (!fs.existsSync(isoPath))
    return !app.isPackaged && fs.existsSync(path.join(folderPath, (isWindows()? "goalc-simple.exe" : "gk")));

  const files = await fs.promises.readdir(isoPath);
  return files.length > 1 && userSettings.gameVersion;
}

async function getLatestGameReleaseVersion() {
  const response = await axios.get("https://api.github.com/repos/JoKronk/teamruns-jak-project/releases", { headers: { 'User-Agent': 'Teamruns' } });
  return "v" + (response.data.length !== 0 ? response.data[0].name.substring(1) : "");
}

async function checkInstallUpToDate() {
  if (!await checkGameIsInstalled()) {
    win.webContents.send("install-missing");
    return;
  }
  else
    win.webContents.send("install-found");
  
  if (await getLatestGameReleaseVersion() !== "v" + userSettings.gameVersion)
    win.webContents.send("install-outdated");
}

function writeInstallVersionToSetting(version) {
  userSettings.gameVersion = version;
  writeSettings(userSettings).then(() => {
    readSettings();
  });
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
async function installGame(gitUrl, isoPath, version) { //downloads and unzips project, then calls extractISO
  if (!isSupportedPlatform())
    return;
  
  await cleanGameInstallLocation();
  sendInstallProgress(1, "Fetching game version");
  version ??= await getLatestGameReleaseVersion();

  sendInstallProgress(3, "Downloading release");
  if (!gitUrl.endsWith("/")) gitUrl += "/";
  gitUrl += "releases/download/" + version;
  gitUrl += isWindows() ? "/opengoal-windows-" + version + ".zip" : "/opengoal-linux-" + version + ".tar.gz";
  const response = await axios.get(gitUrl, { responseType: 'arraybuffer' });
  
  sendInstallProgress(5, "Unzipping");
  let folderPath = getInstallPath();

  if (isWindows()) {
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
  else {
    let tarPath = path.join(folderPath, "OpenGOAL.tar.gz");
    await fs.promises.writeFile(tarPath, response.data, () => {});
    tar.extract(
      {
        file: tarPath,
        cwd: getInstallPath()
      }
    ).then(_=> { 
      fs.promises.unlink(tarPath);
      extractISO(version, isoPath)
    });
  }
}

function extractISO(version, isoPath) {
  const folderPath = getInstallPath();
  let extractProgress = 0;
  const extractTotal = 377; //counted from extaction
  let decompProgress = 0;
  const decompTotal = 24; //counted from decompiling
  let compiling = false;
  let currentProgress = 0;

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
        else if (msg.includes("[info] Extracting")) {
          msg = msg.slice((msg.indexOf("[info] Extracting") + 7));
          extractProgress += 1;
          // 20 from before + 15 (= 35) at end
          let progress = (extractProgress > extractTotal ? extractTotal : extractProgress) / extractTotal * 15 + 20;
          if (currentProgress < progress) {
            currentProgress = progress;
            sendInstallProgress(progress, msg); 
          }
        }
        else if (msg.includes("[info] stats for")) {
          decompProgress += 1;
          // 35 or 20(no extract) from before + 15 (= 50 or 35) at end
          let progress = (decompProgress > decompTotal ? decompTotal : decompProgress) / decompTotal * 15 + (isoPath ? 35 : 20);
          if (currentProgress < progress) {
            currentProgress = progress;
            sendInstallProgress(currentProgress, "Decompiling"); 
          }
        }
      }
      else {
        let progress = msg.match(/\d+% ?/g);
        if (progress) { //50 or 35 from before, goes up to 99
          progress = progress[0].slice(0, -1) / 100 * (isoPath ? 49 : 64) + (isoPath ? 50 : 35);
          if (!isNaN(progress) && currentProgress < progress) {
            currentProgress = progress;
            sendInstallProgress(currentProgress, "Compiling"); 
          }
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