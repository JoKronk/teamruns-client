const net = require('node:net');
const path = require('path');
const winax = require('winax');
const ByteBuffer = require('bytebuffer');
const fs = require('fs');
const spawn = require('child_process').spawn;
let win = null;

var modFilesPath = "/data";

var openGoalGk = null;
var openGoalTracker = null;
var openGoalWatcher = null;
var openGoalGameState = null;
var trackerConnectedState = false;
var openGoalHasStarted = false;

class OpenGoal {

    constructor(window) {
        win = window;
        this.readGameState(null);
     }
     

    // --- GOAL COMUNICATION ---
    async runGameSetup() {
        
        let ogPath = await getOpenGoalPath();
        
        this.sendClientMessage("(1/3) Starting OpenGOAL!");
        if (openGoalGk) {
            openGoalGk.end();
            openGoalGk.destroy();
        }

        openGoalGk = new net.Socket();

        this.killOG();
        await sleep(1000);
        this.startOG(ogPath);
        await sleep(2000);
        
        this.runStateWatcher(ogPath);
        
        openGoalGk.connect(8181, '127.0.0.1', function () { console.log('Connection made with OG!'); });
        openGoalGk.on('connect', () => {
            this.setupOG();
        });

        this.runTracker();
    }


    killOG(spareGk = false) {
        try {
            var shell = new winax.Object('WScript.Shell');
            if (!spareGk)
                shell.Exec("taskkill /F /IM gk.exe");
            shell.Exec("taskkill /F /IM goalc.exe");
            openGoalHasStarted = false;
        }
        catch (e) { this.sendClientMessage(e.message); }
    }

    startOG(ogPath) {
        try {
            var shell = new winax.Object('Shell.Application');
            shell.ShellExecute(ogPath + "\\gk.exe", "-boot -fakeiso -debug", "", "open", 0);
            shell.ShellExecute(ogPath + "\\goalc.exe", "", "", "open", 0);
            openGoalHasStarted = true;
        }
        catch (e) { this.sendClientMessage(e.message); }
    }

    setupOG() {
        console.log("Writing setup commands!")
        this.writeGoalCommand("(lt)");
        this.writeGoalCommand("(set! *debug-segment* #f)");
        this.writeGoalCommand("(mi)");
        this.writeGoalCommand("(set! *cheat-mode* #f)");
        this.writeGoalCommand("(set! (-> *pc-settings* speedrunner-mode?) #t)");
        this.writeGoalCommand("(send-event *target* 'loading)");
        this.writeGoalCommand("(send-event *target* 'get-pickup (pickup-type eco-red) 1.0)");
        console.log(".done");
    }

    writeGoalCommand(args) {
        if (!openGoalHasStarted) return;

        let utf8Encode = new TextEncoder();
        var data = utf8Encode.encode(args);
        var bb = new ByteBuffer().LE().writeInt(data.length).writeInt(10).writeString(args).flip().toBuffer();
        console.log("writing ", args);
        openGoalGk.write(bb);
    }


    
    // --- TRACKING ---
   runTracker() {
    if (openGoalTracker) 
        openGoalTracker.kill();

    console.log("Running Tracker!");
    try {
        openGoalTracker = spawn('python', [path.join(__dirname, '../tracker/JakTracker.py'), path.join(__dirname, '../tracker/')]);     
    }
    catch (err) {
        this.sendClientMessage("Error: " + err);
    }
    //On error
        openGoalTracker.stderr.on('data', (data) => {
            console.log(data.toString());
            this.sendClientMessage("Tracker Error!: " + data.toString());
        });

        //On data
        openGoalTracker.stdout.on('data', (data) => {

            //might contain multiple json objects in invalid format if written to quickly in succession
            for (let jsonString of data.toString().replace(/(\r\n|\n|\r)/gm, "").replace("}{", "}|{").split('|'))
                this.handleTrackerJsonString(jsonString);
        });

        //On kill
        openGoalTracker.stdout.on('end', () => {
            trackerConnectedState = false;
            this.sendClientTrackerState();
            this.sendClientMessage("Tracker Disconneted!");
            this.killOG(true);
        });
        
        this.sendClientMessage("(2/3) Startup successful! Connecting...");

    }

    handleTrackerJsonString(jsonString) {
        //sends invalid json string on opengoal shutdown
        try {
            const trackerObj = JSON.parse(jsonString);
            if (trackerObj.event && trackerObj.event.obtained)
                sendClientTaskUpdate(trackerObj.event.gameTask);
            else if (trackerObj.error)
                this.sendClientMessage("Error: " + trackerObj.error);
            else if (trackerObj.message && trackerObj.message.startsWith("Tracker connected!")) {
                this.writeGoalCommand("(send-event *target* 'loading)");
                this.writeGoalCommand("(send-event *target* 'get-pickup (pickup-type eco-yellow) 1.0)");
                trackerConnectedState = true;
                this.sendClientTrackerState();
                this.sendClientMessage("(3/3) OpenGOAL fully connected!");
            }
        }
        catch (err) {
            this.sendClientMessage("Tracker Error!: " + jsonString);
        }
    }

    runStateWatcher(ogPath) {
        if (openGoalWatcher)
            openGoalWatcher.close();

        let path = ogPath + modFilesPath;
        this.checkCreateFileExists(path + "/mod-states.json");

        openGoalWatcher = fs.watch(path, (event, filename) => {
            if (event != "change") return;

            if (filename == "mod-states.json")
                this.readGameState(path + "/" + filename);
        });
    }

    checkCreateFileExists(file) {
        if (!fs.existsSync(file)) {
            fs.writeFileSync(file, "");
        }
    }

    async readGameState(path) {
        path ??= await getOpenGoalPath() + modFilesPath + "/mod-states.json";
        console.log("reading from " + path);
        fs.readFile(path, 'utf8', (err, data) => {
            if (err) {
                console.log(err);
                return;
            }
            let gameState = JSON.parse(data);
            if (JSON.stringify(openGoalGameState) !== JSON.stringify(gameState)) {
                openGoalGameState = gameState;
                console.log("STATE UPDATE!");
                this.sendClientStateUpdate();
            }
        });
    }

    sendClientTrackerState() {
      win.webContents.send("og-tracker-connected", trackerConnectedState);
    }

    sendClientStateUpdate() {
        win.webContents.send("og-state-update", openGoalGameState);
    }

    sendClientMessage(msg) {
        win.webContents.send("backend-message", msg);
    }
}

function sleep(ms) {
    return new Promise(
        resolve => setTimeout(resolve, ms)
    );
}

function getOpenGoalPath() {
    return new Promise(function(resolve) {
        fs.readFile("./settings.json", 'utf8', function(err, data) {
            if (err) {
                console.log(err);
                return;
            }
            resolve(JSON.parse(data).ogFolderpath);
        });
    });
}

// --- FRONTEND COM ---
function sendClientTaskUpdate(obj) {
  win.webContents.send("og-task-update", obj);
}

module.exports = { OpenGoal };