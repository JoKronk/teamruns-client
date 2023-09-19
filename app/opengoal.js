const net = require('node:net');
const path = require('path');
const winax = require('winax');
const ByteBuffer = require('bytebuffer');
const fs = require('fs');
const spawn = require('child_process').spawn;
const { app } = require('electron');
let win = null;

var openGoalGk = null;
var openGoalTracker = null;
var trackerConnectedState = false;
var openGoalIsRunning = false;
var openGoalHasStarted = false;

var ogSpawn = null;

class OpenGoal {

    constructor(window) {
        win = window;
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
        await sleep(1500);
        this.startOG(ogPath);
        await sleep(2500);
        
        openGoalGk.connect(8181, '127.0.0.1', function () { console.log('Connection made with OG!'); });
        openGoalGk.on('connect', async () => {
            this.setupOG();
            this.runTracker();

            await sleep(2000);
            openGoalHasStarted = true;
        });

        openGoalGk.on('error', (ex) => {
            if (!openGoalHasStarted)
                this.sendClientMessage("Failed to start the client properly, please relaunch!");
        });
    }


    killOG(spareGk = false) {
        try {
            if (openGoalIsRunning) {
                var shell = new winax.Object('WScript.Shell');
                if (!spareGk)
                    shell.Exec("taskkill /F /IM gk.exe");
                shell.Exec("taskkill /F /IM goalc.exe");
            }
            openGoalIsRunning = false;
            openGoalHasStarted = false;

            if (openGoalTracker) 
                spawn("taskkill", ["/pid", openGoalTracker.pid, '/f', '/t']);
        }
        catch (e) { this.sendClientMessage(e); }
    }

    startOG(ogPath) {
        
        ogSpawn = spawn(ogPath + "\\gk.exe", ["--game", "jak1", "--", "-boot", "-fakeiso", "-debug"]);
        //On error
        ogSpawn.stderr.on('data', (data) => {
            const msg = data.toString();
            if (!msg.startsWith("[DECI2] Got message:")) {
                console.log("OG Error!: " + data.toString());
                this.sendClientMessage("OG Error!: " + data.toString());
            }
        });

        //On kill
        ogSpawn.stdout.on('end', () => {
            this.sendClientMessage("OG Disconneted!");
        });

        try {
            var shell = new winax.Object('Shell.Application');
            //shell.ShellExecute(ogPath + "\\gk.exe", "-boot -fakeiso -debug", "", "open", 0);
            shell.ShellExecute(ogPath + "\\goalc.exe", "", "", "open", 0);
            openGoalIsRunning = true;
        }
        catch (e) { this.sendClientMessage(e); }
    }

    setupOG() {
        console.log("Writing setup commands!")
        this.writeGoalCommand("(lt)", true);
        this.writeGoalCommand("(set! *debug-segment* #f)", true);
        this.writeGoalCommand("(mng)", true);
        this.writeGoalCommand("(set! *cheat-mode* #f)", true);
        this.writeGoalCommand("(set! (-> *pc-settings* speedrunner-mode?) #t)", true);
        //!TODO: Swap this one out as soon as possible
        this.writeGoalCommand("(set! *pc-settings-built-sha* \"rev. 20f132 \\nTeamRun Version " + app.getVersion() + "\")", true);
        this.writeGoalCommand("(send-event *target* 'loading)", true);
        this.writeGoalCommand("(send-event *target* 'get-pickup (pickup-type eco-red) 1.0)", true);
        console.log(".done");
    }

    writeGoalCommand(args, isStartupCommand = false) {
        if (!openGoalHasStarted && !isStartupCommand) return;

        let utf8Encode = new TextEncoder();
        var data = utf8Encode.encode(args);
        var bb = new ByteBuffer().LE().writeInt(data.length).writeInt(10).writeString(args).flip().toBuffer();
        console.log("writing ", args);
        openGoalGk.write(bb);
    }


    
    // --- TRACKING ---
   runTracker() {
        console.log("Running Tracker!");
        try {
            openGoalTracker = spawn(path.join(__dirname, '../tracker/JakTracker.exe'), [path.join(__dirname, '../tracker/')]);     
        }
        catch (err) {
            this.sendClientMessage("Error: " + err);
        }

        //On error
        openGoalTracker.stderr.on('data', (data) => {
            console.log("Tracker Error!: " + data.toString());
            //this.sendClientMessage("Tracker Error!: " + data.toString());
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
            if (openGoalHasStarted);
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
            //this.sendClientMessage("Tracker Error!: " + jsonString);
        }
    }

    checkCreateFileExists(file) {
        if (!fs.existsSync(file)) {
            fs.writeFileSync(file, "");
        }
    }

    sendClientTrackerState() {
      win.webContents.send("og-tracker-connected", trackerConnectedState);
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
        fs.readFile(path.join(app.getPath('userData'), 'settings.json'), 'utf8', function(err, data) {
            if (err) 
                console.log(err); 
            else if (data)
                resolve(JSON.parse(data).ogFolderpath);
        });
    });
}

// --- FRONTEND COM ---
function sendClientTaskUpdate(obj) {
  win.webContents.send("og-task-update", obj);
}

module.exports = { OpenGoal };