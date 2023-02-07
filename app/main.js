const {app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');   
	
let win = null;
const devServe = (process.argv.at(-1) === 'dev');

function createWindow() {  
       
  //configs
	win = new BrowserWindow({
    width: 1000, 
    height: 800,
    x: 10,
    y: 10,
    webPreferences: {
        allowRunningInsecureContent: (devServe),
        preload: path.join(__dirname, "preload.js")
    },
    autoHideMenuBar: true,
    resizable: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: 'rgba(0, 0, 0, 0)',
      symbolColor: '#74b1be',
      height: 30
    },
    fullscreenable: false,
    transparent: true,
    frame: false
  });

  if (devServe) {
    const url = require('url');
    const debug = require('electron-debug');
    debug();

    require('electron-reloader')(module);
    win.loadURL('http://localhost:4200');

    win.webContents.openDevTools();
  } 
  else {
    const url = require('url');
    win.loadURL(url.format({      
        pathname: path.join( __dirname, 'teamrun-client/index.html'),       
        protocol: 'file:',      
        slashes: true
    }));
  }
  
    
  //frontend listeners
  ipcMain.on('og-start-game', (event, command) => {
    StartGameSetup();
  });

  ipcMain.on('og-start-run', (event, command) => {
    writeCommand("(progress-fast-save-and-start-speedrun (speedrun-category full-game))");
  });

  ipcMain.on('og-command', (event, command) => {
    writeCommand(command);
  });
    
  ipcMain.on('window-close', () => {
          win = null;
      });

    return win;
} 

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



const net = require('node:net');
var client = new net.Socket();

function sleep(ms) {
    return new Promise(
      resolve => setTimeout(resolve, ms)
    );
  }
  
  async function StartGameSetup() {

    console.log("Closing existing OPENGOAL");
    var winax = require('winax');
    var shell = new winax.Object('WScript.Shell');
    var oExec1 = shell.Exec("taskkill /F /IM gk.exe");
    var oExec2 = shell.Exec("taskkill /F /IM goalc.exe");
    await sleep(2000);

    console.log("Starting new OPENGOAL");
    var oshell = new winax.Object('Shell.Application');
    var obExec1 = oshell.ShellExecute("C:\\Projects\\opengoal-mod-base\\gk.exe" ,"-boot -fakeiso -debug", "", "open", 1);
    var obExec1 = oshell.ShellExecute("C:\\Projects\\opengoal-mod-base\\goalc.exe" ,"", "", "open", 1);
    await sleep(3000);
    
    console.log("Connecting with websocket");
    client.connect(8181, '127.0.0.1', function() {
        console.log('Connected!');
    });
    client.on('connect', function() {
        console.log("writing startup commands!")
        writeCommand("(lt)");
        writeCommand("(set! *debug-segment* #f)");
        writeCommand("(mi)");
        writeCommand("(set! *cheat-mode* #f)");
        writeCommand("(send-event *target* 'loading)");
        writeCommand("(send-event *target* 'get-pickup (pickup-type eco-red) 1.0)");
        console.log(".done");
    });
  }

  function writeCommand(args) {
    var ByteBuffer = require("bytebuffer");
    let utf8Encode = new TextEncoder();
    var data = utf8Encode.encode(args);
    var bb = new ByteBuffer().LE().writeInt(data.length).writeInt(10).writeString(args).flip().toBuffer();
    console.log("writing ", args);
    client.write(bb);
  }
