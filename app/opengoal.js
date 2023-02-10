const net = require('node:net');
const path = require('path');
const winax = require('winax');
const ByteBuffer = require('bytebuffer');
const fs = require('fs');
const spawn = require('child_process').spawn;
let win = null;

var openGoalGk = null;
var openGoalTracker = null;


class OpenGoal {

    constructor(window) {
        win = window;
     }
     

    // --- GOAL COMUNICATION ---
    async runGameSetup() {
        
        sendClientMessage("(1/3) Starting OpenGOAL!");
        if (openGoalGk != null) {
            openGoalGk.end();
            openGoalGk.destroy();
        }

        openGoalGk = new net.Socket();

        this.killOG();
        await sleep(1000);
        this.startOG();
        await sleep(2000);
        
        openGoalGk.connect(8181, '127.0.0.1', function () { console.log('Connection made with OG!'); });
        openGoalGk.on('connect', () => {
            this.setupOG();
        });

    }


    killOG() {
        try {
            var shell = new winax.Object('WScript.Shell');
            shell.Exec("taskkill /F /IM gk.exe");
            shell.Exec("taskkill /F /IM goalc.exe");
        }
        catch (e) { sendClientMessage(e.message); }
    }

    startOG() {
        try {
            var shell = new winax.Object('Shell.Application');
            shell.ShellExecute("C:\\Projects\\opengoal-mod-base\\gk.exe", "-boot -fakeiso -debug", "", "open", 1);
            shell.ShellExecute("C:\\Projects\\opengoal-mod-base\\goalc.exe", "", "", "open", 1);
        }
        catch (e) { sendClientMessage(e.message); }
    }

    setupOG() {
        console.log("Writing setup commands!")
        this.writeGoalCommand("(lt)");
        this.writeGoalCommand("(set! *debug-segment* #f)");
        this.writeGoalCommand("(mi)");
        this.writeGoalCommand("(set! *cheat-mode* #f)");
        this.writeGoalCommand("(send-event *target* 'loading)");
        this.writeGoalCommand("(send-event *target* 'get-pickup (pickup-type eco-red) 1.0)");
        console.log(".done");
    }

    writeGoalCommand(args) {
        let utf8Encode = new TextEncoder();
        var data = utf8Encode.encode(args);
        var bb = new ByteBuffer().LE().writeInt(data.length).writeInt(10).writeString(args).flip().toBuffer();
        console.log("writing ", args);
        openGoalGk.write(bb);
    }


}

function sleep(ms) {
    return new Promise(
        resolve => setTimeout(resolve, ms)
    );
}

// --- FRONTEND COM ---
function sendClientMessage(msg) {
  win.webContents.send("backend-message", msg);
}

module.exports = { OpenGoal };