const {app, ipcMain, BrowserWindow} = require('electron');
const { Authenticator } = require('minecraft-launcher-core');

var childProcess = require("child_process");
var path = require("path");
const fs = require("fs");

  
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

  var MinecraftVersionArg = [arg.data];
  var cp = childProcess.fork(path.join(__dirname, "WardenNew/run_account.js"), MinecraftVersionArg);
  cp.on("exit", function (code, signal) {
    console.log("Exited", {code: code, signal: signal});
  });
  cp.on("error", console.error.bind(console));

  // sleep(10000).then(() => {
  //   app.quit();
  // });

});

ipcMain.on('requestForAppData', (event, arg) => {
  event.reply('requestForAppDataReply', process.env.APPDATA)
})

function signOut() {
  const data223 = fs.readFileSync(process.env.APPDATA + "/warden/auth/auth.json");
  const data333 = JSON.parse(data223);
  Authenticator.invalidate(data333.access_token, data333.client_token);
  window.location = "./index.html";
  fs.unlinkSync(process.env.APPDATA + "/warden/auth/auth.json");
  fs.unlinkSync(process.env.APPDATA + "/warden/auth/auth_profile.json");
}