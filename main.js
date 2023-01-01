const {app, ipcMain, BrowserWindow, dialog} = require('electron');
const { Authenticator } = require('minecraft-launcher-core');
const rpc = require("discord-rpc");
const fs = require("fs");
const childProcess = require('child_process');
const path = require('path')
const config = require('./config.json');
const client = new rpc.Client({ transport: 'ipc' });
const fetch = require('node-fetch');

let win;
let isUserLoggedIn;

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('deep-dark', process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient('deep-dark')
}

if(fs.existsSync(process.env.APPDATA + "/warden/settings.json")) {
  const data = JSON.parse(fs.readFileSync(process.env.APPDATA + "/warden/settings.json"));
  // console.log(data)
  if(data.discordRPC == true) client.login({ clientId : config.DiscordAPI }).catch(console.error);
  else console.log("Discord RPC is disabled because discordRPC = false")
} else {
  client.login({ clientId : config.DiscordAPI }).catch(console.error); 
  console.log("Discord RPC is enabled because settings.json is not found")
}

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
    win = new BrowserWindow({
      icon:'./images/icon.png',
      width: 800,
      height: 600,
      resizable: true,
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
      isUserLoggedIn = true;
    } else {
      win.loadFile('index.html')
      isUserLoggedIn = false;
    }
    process.env.MAIN_WINDOW_ID = win.id;
    if (process.platform == 'win32') {
      // Keep only command line / deep linked arguments
      deeplinkingUrl = process.argv
      // console.log(deeplinkingUrl)
    }
  }
  const gotTheLock = app.requestSingleInstanceLock()

  if (!gotTheLock) {
    app.quit()
  } else {

    app.on('second-instance', (e, argv) => {
      // Someone tried to run a second instance, we should focus our window.
      if (win) {
        if (win.isMinimized()) win.restore()
        win.focus()
      }
      if (process.platform == 'win32') {
        // Keep only command line / deep linked arguments
        deeplinkingUrl = argv.slice(1)[1]
        console.log(deeplinkingUrl)
        if(isUserLoggedIn === true && deeplinkingUrl.includes("deep-dark://gblink")) {
          // imagine url was deep-dark://gblink/939202 get code from url and assign it to variable
          var code = deeplinkingUrl.split("/")[3]
          //fetch GET request https://api.persn.dev/warden/verify/code. and recieve JSON
          var uuid = JSON.parse(fs.readFileSync(process.env.APPDATA + "/warden/auth/auth_profile.json")).id
          fetch(`https://api.persn.dev/warden/verify/${code}/${uuid}`)
          .then(res => res.json())
          .then((out) => {
            if(out.status === "success") {
              // dialog.showErrorBox('Linking Successful', `You have successfully linked to Ghost ID: ${out.ghostID}`)
              dialog.showMessageBox({
                type: "info",
                title: "Linking Successful",
                message: `You have successfully linked to Ghost ID: ${out.ghostID}`,
                buttons: ["OK"]
              })
            } else{
              //alert dialog
              dialog.showErrorBox('Linking Error', `It seems like the code you entered is invalid. Please try again.\n\nError: ${out.status}`)
            }
          });
          
        }
      }
    })

    app.whenReady().then(() => {
      createWindow()
    
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow();
        }
      })
    })

  
    app.on('open-url', (event, url) => {
      console.log(url)
    })
  
  }

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
  var MinecraftArgs = [arg.minecraftEverything];
  var cp = childProcess.fork(path.join(__dirname, "WardenNew/run_account_rewrite.js"), MinecraftArgs);
  cp.on("exit", function (code, signal) {
    console.log("Exited", {code: code, signal: signal});
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