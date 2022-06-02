const { Client, Authenticator } = require('minecraft-launcher-core');
const Downloader = require("nodejs-file-downloader");
const https = require('https');
const launcher = new Client();
const msmc = require("msmc");
const fs = require('fs');
const fetch = require('node-fetch');
const curseforge = require("mc-curseforge-api");
const {Modrinth} = require("modrinth")
var fabric_loader_version = "0.14.6"
var quilt_loader_version;
var forge_loader_version;
var secondaryMCVersion;
var clientLoaderType;
var secondaryClientLoaderType;
const auth = fs.readFileSync(process.env.APPDATA + "/warden/auth/auth.json");
const parsedAuthProfile = JSON.parse(auth);
var auth_profile;

const minecraftDirectory = process.env.APPDATA + "/warden/minecraft";
let settings = { method: "Get" };

const argy = process.argv[2];
var minecraft_version = argy
if(minecraft_version === "1.18.2") {
    quilt_loader_version = "0.17.0-beta.2"
    clientLoaderType = "fabric"
    secondaryMCVersion = "1.18.1"
    secondaryClientLoaderType = "quilt"
    console.log(minecraft_version + " : " + quilt_loader_version);
} else if(minecraft_version === "1.8.9") {
    forge_loader_version = "11.15.1.2318"
    clientLoaderType = "forge"
    secondaryMCVersion = "1.8.9"
    secondaryClientLoaderType = "forge"
    console.log(minecraft_version + " : " + forge_loader_version);
}

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
            console.log(mod)
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

                    const tables = parsedWardenModConfigJSON.entries[minecraft_version];
                    fs.readdir(minecraftDirectory + "/mods", (err, files) => {
                        if(minecraft_version === "1.8.9" && files.length == parsedWardenModConfigJSON.entries["1.18.2"].length) {
                            const fsExtra = require('fs-extra')
                            fsExtra.emptyDirSync(minecraftDirectory + "/mods")
                        }
                        if(minecraft_version === "1.18.2" && files.length == parsedWardenModConfigJSON.entries["1.8.9"].length) {
                            const fsExtra = require('fs-extra')
                            fsExtra.emptyDirSync(minecraftDirectory + "/mods")
                        }
                    });
                    tables.forEach(function(table) {
                        var modID = table.id;
                        var modNAME = table.name;
                        var modSITE = table.site;

                        if(modSITE == "modrinth") {
                            modrinth.mod(modNAME).then(async mod => {
                                const url = await mod.versions();
                                let sodium = []
                                for (let step = 0; step < url.length; step++) {
                                    if((url[step]._source.loaders.includes(clientLoaderType) || url[step]._source.loaders.includes(secondaryClientLoaderType)) && (url[step]._source.game_versions.includes(minecraft_version) || url[step]._source.game_versions.includes(secondaryMCVersion))) {
                                        sodium.push(url[step]._source.date_published);
                                        console.log(url[step]._source.mod_id + " : added")
                                    } else {
                                        console.log(url[step].mod_id + " : none at " + step)
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
                                                    if(files.length == tables.length && percentage == 100.00) {
                                                        sleep(5000);
                                                        thatThingHappened = true;
                                                        finalChecks();
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
                            function capitalizeFirstLetter(string) {
                                return string.charAt(0).toUpperCase() + string.slice(1);
                            }
                            curseforge.getModFiles(modID).then((files) => {
                                let timestampsArray = []
                            for (let step = 0; step < files.length; step++) {
                                    if(files[step].minecraft_versions.includes(minecraft_version) || files[step].minecraft_versions.includes(secondaryMCVersion) && files[step].minecraft_versions.includes(capitalizeFirstLetter(clientLoaderType))) {
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
                                                    //fs.existsSync(minecraftDirectory + "/mods/qsl-1.1.0-beta.13_qfapi-1.0.0-beta.16_fapi-0.53.4_mc-1.18.2")
                                                    if(files.length == tables.length && percentage == 100.00) {
                                                        sleep(5000);
                                                        thatThingHappened = true;
                                                        finalChecks();
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
                        if(files.length == tables.length) {
                            finalChecks();
                        } else {
                            console.log(files.length)
                        }
                    });
                }
            });
        }
    }
}



function finalChecks() {
    console.log("made it here")
    if(forge_loader_version) {
        if (!fs.existsSync(process.env.APPDATA + "/warden/forge/forge-"+minecraft_version+"-"+forge_loader_version+"-"+minecraft_version+"-universal.jar")){
            const fileNN = "forge-"+minecraft_version+"-"+forge_loader_version+"-"+minecraft_version+"-universal.jar";
            const downloader = new Downloader({
                url: "https://maven.minecraftforge.net/net/minecraftforge/forge/"+minecraft_version+"-"+forge_loader_version+"-"+minecraft_version+"/forge-"+minecraft_version+"-"+forge_loader_version+"-"+minecraft_version+"-universal.jar",
                directory: process.env.APPDATA + "/warden/forge",
                fileName: fileNN, //This will be the file name.
                onProgress: function (percentage, chunk, remainingSize) {
                    //Gets called with each chunk.
                    console.log(fileNN+" | ", percentage + "%");
                    fs.readdir(process.env.APPDATA + "/warden/forge", (err, files) => {
                        if(files.length == 1 && percentage == 100.00) {
                            sleep(5000);
                            continueToStart();
                        }
                    });
                },
            });
            try {
                downloader.download();
            } catch (error) {
                console.log(error);
            }
        } else {
            continueToStart();
        }
    } else if(quilt_loader_version) {
        continueToStart();
    }
}

function continueToStart() {
    var assembler;


    console.log("FINAL: "+JSON.stringify(parsedAuthProfile));
    console.log("FINAL ACCESS: "+parsedAuthProfile.access_token);
    console.log("FINAL CLIENT: "+parsedAuthProfile.client_token);


    let opts;
    if(forge_loader_version) {


        opts = {
            clientpackage: null,
            authorization: {
                access_token: parsedAuthProfile.access_token,
                client_token: parsedAuthProfile.client_token,
                uuid: parsedAuthProfile.uuid,
                name: parsedAuthProfile.name,
                user_properties: '{}',
            },
            root: minecraftDirectory,
            javaPath: "C:/Program Files/Java/jre1.8.0_311/bin/java.exe",
            forge: process.env.APPDATA + "/warden/forge/"+"forge-"+minecraft_version+"-"+forge_loader_version+"-"+minecraft_version+"-universal.jar",
            version: {
                number: minecraft_version,
                type: "MCC-Launcher" 
            },
            memory: {
                max: "6G",
                min: "4G"
            },
        }
    } else if(quilt_loader_version) {
        opts = {
            clientpackage: null,
            authorization: {
                access_token: parsedAuthProfile.access_token,
                client_token: parsedAuthProfile.client_token,
                uuid: parsedAuthProfile.uuid,
                name: parsedAuthProfile.name,
                user_properties: '{}',
            },
            root: minecraftDirectory,
            javaPath: "C:/Program Files/Java/jdk-17/bin/java.exe",
            version: {
                number: minecraft_version,
                type: "release",
                custom: "quilt-loader-"+quilt_loader_version+"-"+minecraft_version
            },
            memory: {
                max: "6G",
                min: "4G"
            },
        }
    }

    let finalOpts = opts;
    
    if (!fs.existsSync(minecraftDirectory+"/versions")){
        fs.mkdirSync(minecraftDirectory+"/versions");
        //https://meta.quiltmc.org/v3/versions/loader/1.18.2/0.17.0-beta.2/profile/json
        //quilt-loader-0.17.0-beta.2-1.18.2
    }

    //https://maven.minecraftforge.net/net/minecraftforge/forge/1.8.9-11.15.1.2318-1.8.9/forge-1.8.9-11.15.1.2318-1.8.9-universal.jar
    if(!forge_loader_version) {
        assembler = "quilt-loader-"+quilt_loader_version+"-"+minecraft_version
    } else if(forge_loader_version) {
        assembler = minecraft_version+"-forge" + minecraft_version+"-"+forge_loader_version+"-"+minecraft_version;
    }

    if (!fs.existsSync(minecraftDirectory+"/versions/" + assembler)){
        fs.mkdirSync(minecraftDirectory+"/versions/" + assembler);
    }

    if(forge_loader_version) {
        const replace = require('replace-in-file');
        const options = {
            files: minecraftDirectory+"/config/splash.properties",
            from: [/enabled=true/g],
            to: ["enabled=false"]
        };
        replace(options)
        .then(result => {
            console.log("Replacement results: ",result);
        })
        .catch(error => {
            console.log(error);
        });
    }

    if(!forge_loader_version) {
        if (!fs.existsSync(minecraftDirectory+"/versions/" + assembler+"/"+assembler+".json")){
            const file = fs.createWriteStream(minecraftDirectory+"/versions/" + assembler+"/"+assembler+".json");
            if(!forge_loader_version) {
                file.write('{"id":"quilt-loader-0.17.0-beta.2-1.18.2","inheritsFrom":"1.18.2","releaseTime":"2022-06-01T17:17:38+0000","time":"2022-06-01T17:17:38+0000","type":"release","mainClass":"org.quiltmc.loader.impl.launch.knot.KnotClient","arguments":{"game":[]},"libraries":[{"name":"net.fabricmc:tiny-mappings-parser:0.3.0+build.17","url":"https://maven.fabricmc.net/"},{"name":"net.fabricmc:sponge-mixin:0.11.2+mixin.0.8.5","url":"https://maven.fabricmc.net/"},{"name":"net.fabricmc:tiny-remapper:0.8.1","url":"https://maven.fabricmc.net/"},{"name":"net.fabricmc:access-widener:2.1.0","url":"https://maven.fabricmc.net/"},{"name":"org.quiltmc:quilt-json5:1.0.1","url":"https://maven.quiltmc.org/repository/release/"},{"name":"org.ow2.asm:asm:9.3","url":"https://maven.fabricmc.net/"},{"name":"org.ow2.asm:asm-analysis:9.3","url":"https://maven.fabricmc.net/"},{"name":"org.ow2.asm:asm-commons:9.3","url":"https://maven.fabricmc.net/"},{"name":"org.ow2.asm:asm-tree:9.3","url":"https://maven.fabricmc.net/"},{"name":"org.ow2.asm:asm-util:9.3","url":"https://maven.fabricmc.net/"},{"name":"net.fabricmc:intermediary:1.18.2","url":"https://maven.fabricmc.net/"},{"name":"org.quiltmc:quilt-loader:0.17.0-beta.2","url":"https://maven.quiltmc.org/repository/release/"}]}', 'utf8');
            }
            // const request = https.get("https://meta.quiltmc.org/v3/versions/loader/"+minecraft_version+"/"+quilt_loader_version+"/profile/json", function(response) {
            //     response.pipe(file);
            // });
        }
    }
    launcher.launch(finalOpts);
    // launcher.on('progress', (e) => fs.writeFileSync(process.env.APPDATA + "/warden/progress.json", JSON.stringify(e)));
    launcher.on('progress', (e) => console.log(e));
    launcher.on('debug', (e) => console.log(e));
    launcher.on('data', (e) => console.log(e));
}