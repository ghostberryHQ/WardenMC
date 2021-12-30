const { Client, Authenticator } = require('minecraft-launcher-core');
const { ipcRenderer } = require('electron');
const fs = require("fs");
const msmc = require("msmc");
const fetch = require("node-fetch");

function startMoLP() {
    console.log(document.getElementById("usernameInput").value);
    console.log(document.getElementById("passwordInput").value);
    console.log(Authenticator.getAuth(document.getElementById("usernameInput").value, document.getElementById("passwordInput").value));
}

function startMiLP() {
    //msmc's testing enviroment sometimes runs into this issue that it can't load node fetch
    msmc.setFetch(fetch)
    msmc.fastLaunch("raw",
        (update) => {
            //A hook for catching loading bar events and errors, standard with MSMC
            console.log("CallBack!!!!!")
            console.log(update)
        }).then(result => {
            //Let's check if we logged in?
            if (msmc.errorCheck(result)){
                console.log(result.reason)
                return;
            }
            console.log("Starting!")
            const auth = msmc.getMCLC().getAuth(result);
            const obj1 = JSON.stringify(auth);
            const obj2 = JSON.parse(obj1);
            const obj3 = JSON.stringify(result.profile);
            console.log(obj2.access_token);
            console.log(obj2.client_token);

            if (!fs.existsSync(process.env.APPDATA + "/warden/auth")){
                fs.mkdirSync(process.env.APPDATA + "/warden/auth");
            }

            fs.writeFileSync(process.env.APPDATA + "/warden/auth/auth.json", obj1);
            fs.writeFileSync(process.env.APPDATA + "/warden/auth/auth_profile.json", obj3);
            console.log("Data has been written to file successfully.");
            window.location = "./play.html"; 
            
        }).catch(reason => {
            //If the login fails
            console.log("We failed to log someone in because : " + reason);
        })
}