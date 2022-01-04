const { Client, Authenticator } = require('minecraft-launcher-core');
const Downloader = require("nodejs-file-downloader");
const https = require('https');
const launcher = new Client();
const msmc = require("msmc");
const fs = require('fs');
const fetch = require('node-fetch');
const curseforge = require("mc-curseforge-api");
const {Modrinth} = require("modrinth")
var minecraft_version = "1.18.1"
var fabric_loader_version = "0.12.12"
const auth = fs.readFileSync(process.env.APPDATA + "/warden/auth/auth.json");
const parsedAuthProfile = JSON.parse(auth);
var auth_profile;

const minecraftDirectory = process.env.APPDATA + "/warden/minecraft";
let settings = { method: "Get" };

const modrinth = new Modrinth({
    authorization: "" 
});

checkValid();

function checkValid() {
    auth_profile = fs.readFileSync(process.env.APPDATA + "/warden/auth/auth_profile.json");
    const parsedAuthProfile = JSON.parse(auth_profile);
    const isValid = msmc.validate(parsedAuthProfile);
    console.log(isValid);
    if(isValid == true) {
        modUpdateCheck();
    } else {
        msmc.refresh(parsedAuthProfile).then(async mod => {
            const refreshedFile = JSON.stringify(mod.profile);
            fs.writeFileSync(process.env.APPDATA + "/warden/auth/auth_profile.json", refreshedFile);
            console.log(refreshedFile);
         });
    }
}

function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

function modUpdateCheck() {

    if (!fs.existsSync(process.env.APPDATA+"/warden/mods")){
        fs.mkdirSync(process.env.APPDATA+"/warden/mods");
        console.log("Successfully Created MODS folder");
        checkValid();
    } else if (fs.existsSync(process.env.APPDATA+"/warden/mods")) {
        console.log("User had mods folder");
        if(!fs.existsSync(process.env.APPDATA+"/warden/mods/wardenModConfig.json")){

            fetch("https://gist.githubusercontent.com/spjoes/d5527ea350baf8fa564e17e78f01873d/raw/wardenModConfig.json", settings)
            .then(res => res.json())
            .then((json) => {
                const STRUNGJSON = JSON.stringify(json);
                fs.writeFileSync(process.env.APPDATA + "/warden/mods/wardenModConfig.json", STRUNGJSON);
                checkValid();
            });

        } else if(fs.existsSync(process.env.APPDATA+"/warden/mods/wardenModConfig.json")) {
            console.log("User had wardenModConfig.json");
            const wardenModConfigJSON = fs.readFileSync(process.env.APPDATA+"/warden/mods/wardenModConfig.json");
            const parsedWardenModConfigJSON = JSON.parse(wardenModConfigJSON);
            fetch("https://gist.githubusercontent.com/spjoes/d5527ea350baf8fa564e17e78f01873d/raw/wardenModConfig.json", settings)
                .then(res => res.json())
                .then((json) => {
                const stringifyUrlData = JSON.stringify(json);
                const parsedUrlData = JSON.parse(stringifyUrlData);
                console.log("LOCAL: "+parsedWardenModConfigJSON.version);
                console.log("GIST: "+parsedUrlData.version);

                if(parsedWardenModConfigJSON.version != parsedUrlData.version) {
                    fs.unlinkSync(process.env.APPDATA+"/warden/mods/wardenModConfig.json")
                    console.log("Out of date. Deleted old file");
                    checkValid();
                } else if (parsedWardenModConfigJSON.version == parsedUrlData.version) {
                    console.log("User had up to date file!");

                    if (!fs.existsSync(minecraftDirectory)){
                        fs.mkdirSync(minecraftDirectory);
                    }
                    if(!fs.existsSync(minecraftDirectory + "/mods")) {
                        fs.mkdirSync(minecraftDirectory + "/mods");
                    }

                    var thatThingHappened = false;


                    const tables = parsedWardenModConfigJSON.entries;
                    tables.forEach(function(table) {
                        var modID = table.id;
                        var modNAME = table.name;
                        var modSITE = table.site;

                        if(modSITE == "modrinth") {
                            modrinth.mod(modNAME).then(async mod => {
                                const url = await mod.versions();
                                let sodium = []
                                for (let step = 0; step < url.length; step++) {
                                    if(url[step]._source.game_versions.includes("1.18") || url[step]._source.game_versions.includes("1.18.1") || url[step]._source.game_versions.includes("1.17") || url[step]._source.game_versions.includes("1.17.1")) {
                                        sodium.push(url[step]._source.date_published);
                                    }
                                }
                                sodium.sort();
                                const finalURL = Object.values(url).filter(user => user._source.date_published === sodium.at(-1));

                                if (!fs.existsSync(minecraftDirectory + "/mods/"+finalURL[0].files[0].filename)){
                                    const downloader = new Downloader({
                                        url: finalURL[0].files[0].url,
                                        directory: minecraftDirectory + "/mods",
                                        fileName: finalURL[0].files[0].filename, //This will be the file name.
                                        onProgress: function (percentage, chunk, remainingSize) {
                                            //Gets called with each chunk.
                                            console.log(finalURL[0].files[0].filename+" | ", percentage + "%");
                                            if(!thatThingHappened) {
                                                fs.readdir(minecraftDirectory + "/mods", (err, files) => {
                                                    if(files.length == 25 && percentage == 100.00) {
                                                        sleep(5000);
                                                        thatThingHappened = true;
                                                        continueToStart();
                                                    }
                                                });
                                            }
                                          },
                                      });
                                      try {
                                        downloader.download();
                                      } catch (error) {
                                        console.log(error);
                                      }
                                }

                             });

                        }
                        else if (modSITE == "curseforge") {
                            curseforge.getModFiles(modID).then((files) => {
                                let timestampsArray = []
                            for (let step = 0; step < files.length; step++) {
                                    if(files[step].minecraft_versions.includes("1.18") || files[step].minecraft_versions.includes("1.18.1") || files[step].minecraft_versions.includes("1.17") || files[step].minecraft_versions.includes("1.17.1")) {
                                        timestampsArray.push(files[step].timestamp);
                                    }
                                }
                                timestampsArray.sort();
                                const finalURL = Object.values(files).filter(user => user.timestamp === timestampsArray.at(-1));
                                var urlforfilename = finalURL[0].download_url;
                                var filename = urlforfilename.substring(urlforfilename.lastIndexOf('/')+1);

                                if (!fs.existsSync(minecraftDirectory + "/mods/"+filename)){
                                    const downloader = new Downloader({
                                        url: finalURL[0].download_url,
                                        directory: minecraftDirectory + "/mods",
                                        fileName: filename, //This will be the file name.
                                        onProgress: function (percentage, chunk, remainingSize) {
                                            //Gets called with each chunk.
                                            console.log(filename+" | ", percentage + "%");

                                            if(!thatThingHappened) {
                                                fs.readdir(minecraftDirectory + "/mods", (err, files) => {
                                                    if(files.length == 25 && percentage == 100.00 && fs.existsSync(minecraftDirectory + "/mods/fabric-api-0.44.0+1.18.jar")) {
                                                        sleep(5000);
                                                        thatThingHappened = true;
                                                        continueToStart();
                                                    }
                                                });
                                            }
                                          },
                                      });
                                      try {
                                        downloader.download();
                                      } catch (error) {
                                        console.log(error);
                                      }
                                }
                                
                            });
                        }
                        else {
                            console.log("Mod: " + modNAME + " is unsupported and uses " + modSITE);
                        }
                    });
                    fs.readdir(minecraftDirectory + "/mods", (err, files) => {
                        if(files.length == parsedUrlData.length) {
                            merge();
                        }
                    });
                }
            });
        }
    }
}


function merge() {
    continueToStart();
}

function continueToStart() {
    console.log("FINAL: "+parsedAuthProfile);
    console.log("FINAL ACCESS: "+parsedAuthProfile.access_token);
    console.log("FINAL CLIENT: "+parsedAuthProfile.client_token);

    let opts = {
        clientpackage: null,
        authorization: {
            access_token: parsedAuthProfile.access_token,
            client_token: parsedAuthProfile.client_token,
            uuid: parsedAuthProfile.uuid,
            name: parsedAuthProfile.name,
            user_properties: '{}',
        },
        root: minecraftDirectory,
        version: {
            number: minecraft_version,
            type: "release",
            custom: "fabric-loader-"+fabric_loader_version+"-"+minecraft_version
        },
        memory: {
            max: "6G",
            min: "4G"
        },
    }
    
    if (!fs.existsSync(minecraftDirectory+"/versions")){
        fs.mkdirSync(minecraftDirectory+"/versions");
    }
    if (!fs.existsSync(minecraftDirectory+"/versions/" + "fabric-loader-"+fabric_loader_version+"-"+minecraft_version)){
        fs.mkdirSync(minecraftDirectory+"/versions/" + "fabric-loader-"+fabric_loader_version+"-"+minecraft_version);
    }

    if (!fs.existsSync(minecraftDirectory+"/versions/" + "fabric-loader-"+fabric_loader_version+"-"+minecraft_version+"/fabric-loader-"+fabric_loader_version+"-"+minecraft_version+".json")){
        const file = fs.createWriteStream(minecraftDirectory+"/versions/" + "fabric-loader-"+fabric_loader_version+"-"+minecraft_version+"/fabric-loader-"+fabric_loader_version+"-"+minecraft_version+".json");
        const request = https.get("https://meta.fabricmc.net/v2/versions/loader/"+minecraft_version+"/"+fabric_loader_version+"/profile/json", function(response) {
            response.pipe(file);
        });
    }
    launcher.launch(opts);
    // launcher.on('progress', (e) => fs.writeFileSync(process.env.APPDATA + "/warden/progress.json", JSON.stringify(e)));
    launcher.on('progress', (e) => console.log(e));
    launcher.on('debug', (e) => console.log(e));
    launcher.on('data', (e) => console.log(e));
}