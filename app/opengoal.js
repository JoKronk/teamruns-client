const net = require('node:net');
const path = require('path');
const winax = require('winax');
const ByteBuffer = require('bytebuffer');
const fs = require('fs');
const spawn = require('child_process').spawn;
const { app } = require('electron');
let win = null;

var openGoalREPL = null;
var replHasStarted = false;
var replIsRunning = false;

var mainOpenGoalIsRunning = false;
var openGoalInstances = [];
var openGoalMainPort = 8111;

var firstStart = true;

var runRepl = false;

class OpenGoal {

    constructor(window, runDebugger) {
        win = window;
        runRepl = runDebugger;
     }
     

    // --- GOAL COMUNICATION ---
    async preStartREPL() {

        let ogPath = await getOpenGoalPath();
        if (!ogPath) return;

        if (openGoalREPL) {
            openGoalREPL.end();
            openGoalREPL.destroy();
        }
        openGoalREPL = new net.Socket();

        if (replHasStarted || firstStart) {
            this.killOG();
            firstStart = false;
            await sleep(1500);
        }

        //start REPL
        try {
            var shell = new winax.Object('Shell.Application');
            //shell.ShellExecute(ogPath + "\\gk.exe", "-boot -fakeiso -debug", "", "open", 0);
            shell.ShellExecute(ogPath + "\\goalc.exe", "", "", "open");
            replHasStarted = true;
        }
        catch (e) { this.sendClientMessage(e); }
        
        await sleep(2500);

        //connect to REPL
        openGoalREPL.connect(8181, '127.0.0.1', function () { console.log('Connection made with REPL!'); });
        openGoalREPL.on('connect', async () => {
            replIsRunning = true;
            this.writeGoalCommand("(mng)");
        });

        openGoalREPL.on('error', (ex) => {
            if (!mainOpenGoalIsRunning)
                this.sendClientMessage("Failed to start the client properly, please relaunch!");
        });

        openGoalREPL.on('close', () => {
            replHasStarted = false;
            replIsRunning = false;
        });
    }



    async startOG(port) {
        if (mainOpenGoalIsRunning && port === openGoalMainPort && openGoalInstances.length <= 1) {
            this.killGK();
            await sleep(1500);
        }

        this.sendClientMessage("Starting OpenGOAL!");
        this.startGK(await getOpenGoalPath(), port);

        if (runRepl) {
            if (!replIsRunning)
                await this.preStartREPL();
            
    
            if (!replHasStarted)
                this.sendClientMessage("Startup failed, REPL never launched");
            
            
    
            if (replHasStarted && !replIsRunning) {
                console.log("Starting pre REPL (lt) connection sleep 1")
                await sleep(1500);
            }
    
            if (replHasStarted && !replIsRunning) {
                console.log("Starting pre REPL (lt) connection sleep 2")
                await sleep(3500);
            }
            
            console.log("Connecting to OG and writing setup commands!")
            this.writeGoalCommand("(lt)");
            this.writeGoalCommand("(mark-repl-connected)");
        }

        if (!mainOpenGoalIsRunning)
            await this.stallSecondsForGkLaunch(5);

        console.log(".done");
        win.webContents.send("og-launched", port);
    }

    async stallSecondsForGkLaunch(seconds) {
        for (let i = 0; i < seconds; i++) {
            await sleep(1000);
            if (mainOpenGoalIsRunning) {
                return;
            }
        }
    }

    startGK(ogPath, port) {
        let openGoalClient = spawn(ogPath + "\\gk.exe", ["--socketport", port, "--game", "jak1", "--", "-boot", "-fakeiso", "-debug"], {detached: true, shell: true});
        openGoalInstances.push(openGoalClient);

        //On error
        openGoalClient.stderr.on('data', (data) => {
            const msg = data.toString();
            if (!msg.startsWith("[DECI2] Got message:")) {
                console.log("OG Error!: " + data.toString());
                this.sendClientMessage("OG Error!: " + data.toString());
            }
        });

        //On kill
        openGoalClient.stdout.on('end', () => {
            win.webContents.send("og-closed", port);
            openGoalInstances.splice(openGoalInstances.indexOf(openGoalClient), 1);
            this.sendClientMessage("OG Disconneted!");
        });

        //On Full Start
        openGoalClient.on('spawn', () => {
            if (port === openGoalMainPort)
                mainOpenGoalIsRunning = true;
        });
    }


    killOG() {
        this.killREPL();
        this.killGK();
    }

    killREPL() {
        if (!replHasStarted && !firstStart) return;
        try {
            var shell = new winax.Object('WScript.Shell');
            shell.Exec("taskkill /F /IM goalc.exe");

            replHasStarted = false;
            replIsRunning = false;
        }
        catch (e) { this.sendClientMessage(e); }
    }

    killGK() {
        if (!mainOpenGoalIsRunning && !firstStart) return;
        try {
            var shell = new winax.Object('WScript.Shell');
            shell.Exec("taskkill /F /IM gk.exe");

            mainOpenGoalIsRunning = false;
        }
        catch (e) { this.sendClientMessage(e); }
    }



    writeGoalCommand(args) {
        if (!replIsRunning) return;

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