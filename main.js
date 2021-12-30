const {app, ipcMain, BrowserWindow} = require('electron');
const { Authenticator } = require('minecraft-launcher-core');

var childProcess = require("child_process");
var path = require("path");
const fs = require("fs");
const rpc = require("discord-rpc");
const client = new rpc.Client({ transport: 'ipc' });

client.login({ clientId : '926165825843494933' }).catch(console.error); 
  
  function createWindow () {
    const win = new BrowserWindow({
      icon:'./images/icon.png',
      width: 800,
      height: 600,
      resizable: false,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        //devTools: false
    }
    })
    if (fs.existsSync(process.env.APPDATA + "/warden/auth/auth.json") && fs.existsSync(process.env.APPDATA + "/warden/auth/auth_profile.json")) {
      win.loadFile('play.html')
    } else {
      win.loadFile('index.html')
    }
  }

  
  app.whenReady().then(() => {
    createWindow()
  
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

//StartGame
ipcMain.on('startGame', (event, arg) => {

  if(!fs.existsSync(process.env.APPDATA + "/warden/auth/auth.json") && !fs.existsSync(process.env.APPDATA + "/warden/auth/auth_profile.json")) {
    app.quit();
  }

  var cp = childProcess.fork(path.join(__dirname, "WardenNew/run_account.js"));
  cp.on("exit", function (code, signal) {
    console.log("Exited", {code: code, signal: signal});
  });
  cp.on("error", console.error.bind(console));

  // sleep(10000).then(() => {
  //   app.quit();
  // });

});

function signOut() {
  const data223 = fs.readFileSync(process.env.APPDATA + "/warden/auth/auth.json");
  const data333 = JSON.parse(data223);
  Authenticator.invalidate(data333.access_token, data333.client_token);
  window.location = "./index.html";
  fs.unlinkSync(process.env.APPDATA + "/warden/auth/auth.json");
  fs.unlinkSync(process.env.APPDATA + "/warden/auth/auth_profile.json");
}

// client.updatePresence({
//   state: 'Poking Around',
//   startTimestamp: Date.now(),
//   largeImageKey: 'warden_head',
//   smallImageKey: 'warden_head',
//   instance: true
// });

client.on('ready', () => {
  console.log('Your presence works now check your discord profile :D')
  client.request('SET_ACTIVITY', {
  pid: process.pid,
  activity: {
      state: 'Poking Around',
  assets: {
           large_image: 'warden_head',
  },
  timestamps: {
    start: Date.now(),
  },
  // buttons : [
  //     {
  //         label : config.Button1,url : config.Url1
  //     },
  //     { 
  //         label : config.Button2,url : config.Url2
  //     },
  //   //labels are the buttons that you wanna provide to your rich presence and urls are the links that leads you when someone press that button
  //   //Note the button won't work for you but don't worry it work for others
  //     ]
      }
  })
  })