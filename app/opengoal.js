const net = require('node:net');
const path = require('path');
const winax = require('winax');
const ByteBuffer = require('bytebuffer');
const fs = require('fs');
const spawn = require('child_process').spawn;
const { app } = require('electron');
let win = null;

var openGoalREPL = null;
var openGoalIsRunning = false;
var openGoalHasStarted = false;

var openGoalGk = null;

class OpenGoal {

    constructor(window) {
        win = window;
     }
     

    // --- GOAL COMUNICATION ---
    async runGameSetup() {
        
        let ogPath = await getOpenGoalPath();
        
        this.sendClientMessage("(1/2) Starting OpenGOAL!");
        if (openGoalREPL) {
            openGoalREPL.end();
            openGoalREPL.destroy();
        }

        openGoalREPL = new net.Socket();

        this.killOG();
        await sleep(1500);
        this.startOG(ogPath);
        await sleep(2500);
        
        win.webContents.send("og-launched", true);
        openGoalREPL.connect(8181, '127.0.0.1', function () { console.log('Connection made with OG!'); });
        openGoalREPL.on('connect', async () => {
            this.setupOG();

            await sleep(2000);
            openGoalHasStarted = true;
        });

        openGoalREPL.on('error', (ex) => {
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
        }
        catch (e) { this.sendClientMessage(e); }
    }

    startOG(ogPath) {
        
        openGoalGk = spawn(ogPath + "\\gk.exe", ["--game", "jak1", "--", "-boot", "-fakeiso", "-debug"]);
        //On error
        openGoalGk.stderr.on('data', (data) => {
            const msg = data.toString();
            if (!msg.startsWith("[DECI2] Got message:")) {
                console.log("OG Error!: " + data.toString());
                this.sendClientMessage("OG Error!: " + data.toString());
            }
        });

        //On kill
        openGoalGk.stdout.on('end', () => {
            win.webContents.send("og-launched", false);
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
        //this.writeGoalCommand("(set! *debug-segment* #f)", true);
        this.writeGoalCommand("(mng)", true);
        this.writeGoalCommand("(set! *cheat-mode* #f)", true);
        this.writeGoalCommand("(set! (-> *pc-settings* speedrunner-mode?) #t)", true);
        //!TODO: Swap this one out as soon as possible
        //this.writeGoalCommand("(set! *pc-settings-built-sha* \"rev. 20f132 \\nTeamRun Version " + app.getVersion() + "\")", true);
        this.writeGoalCommand("(mark-repl-connected)", true);
        console.log(".done");
    }

    writeGoalCommand(args, isStartupCommand = false) {
        if (!openGoalHasStarted && !isStartupCommand) return;

        let utf8Encode = new TextEncoder();
        var data = utf8Encode.encode(args);
        var bb = new ByteBuffer().LE().writeInt(data.length).writeInt(10).writeString(args).flip().toBuffer();
        console.log("writing ", args);
        openGoalREPL.write(bb);
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

module.exports = { OpenGoal };