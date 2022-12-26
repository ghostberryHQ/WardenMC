const {app, ipcMain, BrowserWindow} = require('electron');
const { Authenticator } = require('minecraft-launcher-core');
const rpc = require("discord-rpc");
const config = require('./config.json')
const fs = require("fs");
const childProcess = require('child_process');
const path = require('path');
const client = new rpc.Client({ transport: 'ipc' });
client.login({ clientId : config.DiscordAPI }).catch(console.error); 

if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

function handleSquirrelEvent() {
  if (process.argv.length === 1) {
    return false;
  }

  const appFolder = path.resolve(process.execPath, '..');
  const rootAtomFolder = path.resolve(appFolder, '..');
  const updateDotExe = path.resolve(path.join(rootAtomFolder, 'Update.exe'));
  const exeName = path.basename(process.execPath);

  const spawn = function(command, args) {
    let spawnedProcess, error;

    try {
      spawnedProcess = childProcess.spawn(command, args, {detached: true});
    } catch (error) {}

    return spawnedProcess;
  };

  const spawnUpdate = function(args) {
    return spawn(updateDotExe, args);
  };

  const squirrelEvent = process.argv[1];
  switch (squirrelEvent) {
    case '--squirrel-install':
    case '--squirrel-updated':
      // Optionally do things such as:
      // - Add your .exe to the PATH
      // - Write to the registry for things like file associations and
      //   explorer context menus

      // Install desktop and start menu shortcuts
      spawnUpdate(['--createShortcut', exeName]);

      setTimeout(app.quit, 1000);
      return true;

    case '--squirrel-uninstall':
      // Undo anything you did in the --squirrel-install and
      // --squirrel-updated handlers

      // Remove desktop and start menu shortcuts
      spawnUpdate(['--removeShortcut', exeName]);

      setTimeout(app.quit, 1000);
      return true;

    case '--squirrel-obsolete':
      // This is called on the outgoing version of your app before
      // we update to the new version - it's the opposite of
      // --squirrel-updated

      app.quit();
      return true;
  }
};

  function createWindow () {
    const win = new BrowserWindow({
      icon:'./images/icon.png',
      width: 800,
      height: 600,
      resizable: false,
      autoHideMenuBar: true,
      webPreferences: {
        enableRemoteModule: true,
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
    process.env.MAIN_WINDOW_ID = win.id;
  }
  
  app.whenReady().then(() => {
    createWindow()
    fs.writeFileSync(process.env.APPDATA + "/warden/ugh.json", "init\n");
  
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
  fs.writeFileSync(process.env.APPDATA + "/warden/ugh2.json", path.join(__dirname, "WardenNew/run_account.js"));

  var MinecraftArgs = [arg.minecraftEverything];
  //run child process WardenNew/run_account.js using childprocess.fork
  var cp = childProcess.fork(path.join(__dirname, "WardenNew/run_account.js"), MinecraftArgs);
  cp.on("exit", function (code, signal) {
    console.log("Exited", {code: code, signal: signal});
    fs.appendFileSync(process.env.APPDATA + "/warden/ugh.json", code + " | " + signal + "\n");
  });
  cp.on("error", console.error.bind(console));
});

ipcMain.on('requestForAppData', (event, arg) => {
  event.reply('requestForAppDataReply', process.env.APPDATA)
})

ipcMain.on('zong', (event, arg) => {
  console.log(arg.ontry[0])
})

function signOut() {
  const data223 = fs.readFileSync(process.env.APPDATA + "/warden/auth/auth.json");
  const data333 = JSON.parse(data223);
  Authenticator.invalidate(data333.access_token, data333.client_token);
  window.location = "./index.html";
  fs.unlinkSync(process.env.APPDATA + "/warden/auth/auth.json");
  fs.unlinkSync(process.env.APPDATA + "/warden/auth/auth_profile.json");
}

client.on('ready', () => {
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
    }
  })
});