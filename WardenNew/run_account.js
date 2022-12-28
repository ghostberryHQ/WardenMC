const { Client, Authenticator } = require('minecraft-launcher-core');
const Downloader = require("nodejs-file-downloader");
const launcher = new Client();
const msmc = require("msmc");
const fs = require('fs');
const fetch = require('node-fetch');
const {Modrinth} = require("modrinth")
var AdmZip = require("adm-zip");
const fsExtra = require('fs-extra');
var minecraftVersion;
var secondaryMCVersion;
var clientLoaderType;
var secondaryClientLoaderType;
var loaderVersion;
var javaEdition;
var source;
var layoutName;

const auth = fs.readFileSync(process.env.APPDATA + "/warden/auth/auth.json");
const parsedAuthProfile = JSON.parse(auth);
var auth_profile;

const minecraftDirectory = process.env.APPDATA + "/warden/minecraft";
let settings = { method: "Get" };

var argy = (process.argv[2]).split(',');
console.log(process.argv)
console.log(argy)
minecraftVersion = argy[0]
secondaryMCVersion = argy[1]
clientLoaderType = argy[2]
secondaryClientLoaderType = argy[3]
loaderVersion = argy[4]
javaEdition = argy[5]
source = argy[6]
layoutName = argy[7]

// console.log(minecraftVersion + " : " + loaderVersion);

const modrinth = new Modrinth({
    authorization: "" 
});

// checkValid();

function checkValid() {
    auth_profile = fs.readFileSync(process.env.APPDATA + "/warden/auth/auth_profile.json");
    const parsedAuthProfile = JSON.parse(auth_profile);
    const isValid = msmc.validate(parsedAuthProfile);

    console.log(isValid);
    if(isValid == true) {
        modUpdateCheck();
    } else {
        console.log(parsedAuthProfile)
        msmc.refresh(parsedAuthProfile).then(async newProfile => {
            console.log(newProfile);
            if(newProfile.reason === "Could not log into Microsoft" && newProfile.translationString === "Login.Fail.MS") {
                console.log("Invalid");

                fs.unlinkSync(process.env.APPDATA + "/warden/auth/auth_profile.json");
                fs.unlinkSync(process.env.APPDATA + "/warden/auth/auth.json");

            } else {
                console.log("valid")
                modUpdateCheck();
            }
        }).catch(err => {
            console.log(err);
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

            fetch("https://api.persn.dev/warden/getMods", settings)
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
            fetch("https://api.persn.dev/warden/getMods", settings)
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

                    if(!fs.existsSync(minecraftDirectory + "/mods")) {
                        fs.mkdirSync(minecraftDirectory + "/mods", {recursive: true});
                    }

                    var thatThingHappened = false;

                    var tables;
                    if(source === "official") tables = parsedWardenModConfigJSON.entries[minecraftVersion];
                    if(source === "layout") tables = JSON.parse(fs.readFileSync(process.env.APPDATA + "/warden/layouts/" + layoutName)).mods;

                        fs.readdir(process.env.APPDATA + "/warden/minecraft/" + "/mods", (err, files) => {
                            if(!tables || files.length != tables.length) {
                                console.log("checking")
                                if(fs.existsSync(minecraftDirectory + "/mods")) {
                                    fs.rmSync(minecraftDirectory + "/mods", { recursive: true })
                                    fs.mkdirSync(minecraftDirectory + "/mods");
                                }
                            } else {
                                console.log("User had correct amount of mods");
                            }
                        });


                        console.log("TAPL: " +tables)
                        if(!tables) {
                            console.log("no")
                        } else {
                            console.log("yes")
                        }


                        if(tables) {
                            tables.forEach(function(table) {
                                var modID = table.id;
                                var modNAME = table.name;
                                var modSITE = table.site;
    
                                if(modSITE == "modrinth") {
                                    modrinth.mod(modNAME).then(async mod => {
                                        const url = await mod.versions().catch(err => {console.log(err)});
                                        let sodium = []
                                        for (let step = 0; step < url.length; step++) {
                                            if((url[step]._source.loaders.includes(clientLoaderType) || url[step]._source.loaders.includes(secondaryClientLoaderType)) && (url[step]._source.game_versions.includes(minecraftVersion) || url[step]._source.game_versions.includes(secondaryMCVersion))) {
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
                                                    // console.log(finalURL[0].files[0].filename+" | ", percentage + "%");
                                                    obj = {
                                                        type: "modification",
                                                        task: percentage,
                                                        total: 100
                                                    }
                                                    fs.writeFileSync(process.env.APPDATA + "/warden/progress.json", JSON.stringify(obj));
                                                    if(!thatThingHappened) {
                                                        fs.readdir(minecraftDirectory + "/mods", (err, files) => {
                                                            if(files.length == tables.length) {
                                                                setTimeout(function() {
                                                                    if(obj.task == 100.00 && !thatThingHappened) {
                                                                        console.log("yep!")
                                                                        thatThingHappened = true;
                                                                        finalChecks();
                                                                    }
                                                                }, 5000);
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
    
                                    }).catch(err => {
                                        console.log(err);
                                    });
    
                                } else if(modSITE == "persnAPI") {
                                    var urlToDownloadMod = modID;
                                    if (!fs.existsSync(minecraftDirectory + "/mods/"+modNAME+".jar")) {
                                        const downloader = new Downloader({
                                            url: urlToDownloadMod,
                                            directory: minecraftDirectory + "/mods",
                                            fileName: modNAME+".jar", //This will be the file name.
                                            onProgress: function (percentage, chunk, remainingSize) {
                                                //Gets called with each chunk.
                                                // console.log(finalURL[0].files[0].filename+" | ", percentage + "%");
                                                obj = {
                                                    type: "modification",
                                                    task: percentage,
                                                    total: 100
                                                }
                                                fs.writeFileSync(process.env.APPDATA + "/warden/progress.json", JSON.stringify(obj));
                                                if(!thatThingHappened) {
                                                    fs.readdir(minecraftDirectory + "/mods", (err, files) => {
                                                        if(files.length == tables.length) {
                                                            setTimeout(function() {
                                                                if(obj.task == 100.00 && !thatThingHappened) {
                                                                    console.log("yep!")
                                                                    sleep(5000);
                                                                    thatThingHappened = true;
                                                                    finalChecks();
                                                                }
                                                            }, 5000);
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
                                }
                                else if(modSITE == "url") {

                                    var urlToDownloadMod = modID;
                                    if (!fs.existsSync(minecraftDirectory + "/mods/"+modNAME+".jar")) {
                                        const downloader = new Downloader({
                                            url: urlToDownloadMod,
                                            directory: minecraftDirectory + "/mods",
                                            fileName: modNAME+".jar", //This will be the file name.
                                            onProgress: function (percentage, chunk, remainingSize) {
                                                //Gets called with each chunk.
                                                // console.log(finalURL[0].files[0].filename+" | ", percentage + "%");
                                                obj = {
                                                    type: "modification",
                                                    task: percentage,
                                                    total: 100
                                                }
                                                fs.writeFileSync(process.env.APPDATA + "/warden/progress.json", JSON.stringify(obj));
                                                if(!thatThingHappened) {
                                                    fs.readdir(minecraftDirectory + "/mods", (err, files) => {
                                                        if(files.length == tables.length) {
                                                            setTimeout(function() {
                                                                if(obj.task == 100.00 && !thatThingHappened) {
                                                                    console.log("yep!")
                                                                    sleep(5000);
                                                                    thatThingHappened = true;
                                                                    finalChecks();
                                                                }
                                                            }, 5000);
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
                                }
                                else if (modSITE == "curseforge") {
                                    function capitalizeFirstLetter(string) {
                                        return string.charAt(0).toUpperCase() + string.slice(1);
                                    }
                                    fetch(`https://api.persn.dev/curseforge/${modID}`)
                                    .then(res => res.json())
                                    .then(json => {
                                        let timestampsArray = []
                                        // console.log(modNAME)
                                        for (let step = 0; step < json.data.length; step++) {
                                            // console.log(json.data[step].gameVersions + "|" + modNAME+ "|" + minecraftVersion)
                                            if(modNAME === "mouse-tweaks" && (json.data[step].gameVersions.includes(minecraftVersion) || json.data[step].gameVersions.includes(secondaryMCVersion))) {
                                                timestampsArray.push(json.data[step].fileDate);
                                            }else if((json.data[step].gameVersions.includes(minecraftVersion) || json.data[step].gameVersions.includes(secondaryMCVersion)) && (json.data[step].gameVersions.includes(capitalizeFirstLetter(clientLoaderType)) || json.data[step].gameVersions.includes(capitalizeFirstLetter(secondaryClientLoaderType)))) {
                                                timestampsArray.push(json.data[step].fileDate);
                                            } else if(json.data[step].gameVersions.includes(minecraftVersion) || json.data[step].gameVersions.includes(secondaryMCVersion)){
                                                timestampsArray.push(json.data[step].fileDate);
                                            }
                                            timestampsArray.sort();
                                        }
                                        setTimeout(function() {
                                        const finalURL = Object.values(json.data).filter(user => user.fileDate === timestampsArray.at(-1));
                                        console.log(modNAME)
                                        if(finalURL[0].downloadUrl == null) {
                                            console.log("No file found for " + modNAME);
                                        } else {
                                            var urlforfilename;
                                            urlforfilename = finalURL[0].downloadUrl;
                                            var filename = urlforfilename.substring(urlforfilename.lastIndexOf('/')+1);
                                            
                                            console.log(filename)
                                            if (!fs.existsSync(minecraftDirectory + "/mods/"+filename)){
                                                const downloader = new Downloader({
                                                    url: finalURL[0].downloadUrl,
                                                    directory: minecraftDirectory + "/mods",
                                                    fileName: filename, //This will be the file name.
                                                    onProgress: function (percentage, chunk, remainingSize) {
                                                        //Gets called with each chunk.
                                                        // console.log(filename+" | ", percentage + "%");
                                                        obj = {
                                                            type: "modification",
                                                            task: percentage,
                                                            total: 100
                                                        }
                                                        fs.writeFileSync(process.env.APPDATA + "/warden/progress.json", JSON.stringify(obj));
                                                        if(!thatThingHappened) {
                                                            fs.readdir(minecraftDirectory + "/mods", (err, files) => {
                                                                if(files.length == tables.length) {
                                                                    setTimeout(function() {
                                                                        if(obj.task == 100.00 && !thatThingHappened) {
                                                                            console.log("yep!")
                                                                            sleep(5000);
                                                                            thatThingHappened = true;
                                                                            finalChecks();
                                                                        }
                                                                    }, 5000);
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
                                        }
                                        }, 1000);
                                    });
                                }
                                else {
                                    console.log("Mod: " + modNAME + " is unsupported and uses " + modSITE);
                                }
                            });
                            fs.readdir(minecraftDirectory + "/mods", (err, files) => {
                                console.log(tables.length)
                                if(files.length == tables.length) {
                                    finalChecks();
                                } else {
                                    console.log(files.length + " mods installed" );
                                }
                            });
                            
                        } else {
                                fs.rmSync(minecraftDirectory + "/mods")
                                finalChecks();
                        }
                    }
                // }
            });
        }
    }
}



function finalChecks() {
    sleep(5000)
    console.log("made it here")
    if(!fs.existsSync(process.env.APPDATA + "/warden/java")) {
        fs.mkdirSync(process.env.APPDATA + "/warden/java");
    }

    if(javaEdition === "Legacy") {
        console.log("LEGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG")
        if(!fs.existsSync(process.env.APPDATA + "/warden/java/copper")) {
            fs.mkdirSync(process.env.APPDATA + "/warden/java/copper");
            console.log("doesnt have")
            const downloader = new Downloader({
                url: "https://github.com/adoptium/temurin8-binaries/releases/download/jdk8u352-b08/OpenJDK8U-jdk_x64_windows_hotspot_8u352b08.zip",
                directory: process.env.APPDATA + "/warden/java/copper",
                fileName: "OpenJDK8U-jdk.zip", //This will be the file name.
                onProgress: function (percentage, chunk, remainingSize) {
                    //Gets called with each chunk.
                    obj = {
                        type: "java",
                        task: percentage,
                        total: 100
                    }
                    if(obj.task > 60.00) console.log("javaLegacy | ", obj.task + "%");
                    fs.writeFileSync(process.env.APPDATA + "/warden/progress.json", JSON.stringify(obj));
                    if(obj.task == 100.00) {
                        setTimeout(function(){
                            afterJava();
                        }, 5000);
                    }
                },
            });
            try {
                downloader.download();
            } catch (error) {
                console.log(error);
            }
        } else {
            console.log("has")
            afterJava()
        }
    } else {
        afterJava();
    }
}

function afterJava() {
    console.log("here : " + clientLoaderType);
    if(clientLoaderType === "forge") {
        if(!fs.existsSync(minecraftDirectory + "/config")) {
            fs.mkdirSync(minecraftDirectory + "/config");
        }
        if(!fs.existsSync(minecraftDirectory + "/config/customwindowtitle-client.toml")) {
            try {
                fs.writeFileSync(minecraftDirectory + "/config/customwindowtitle-client.toml", 'title = "WardenMC | {mcversion}"');
            } catch (err) {
                console.error(err);
            }
        }
        if(!fs.existsSync(process.env.APPDATA + "/warden/java/")) {
            fs.mkdirSync(process.env.APPDATA + "/warden/java/");
        }

        if(fs.existsSync(`${process.env.APPDATA}/warden/java/copper/OpenJDK8U-jdk.zip`)) {
            unzipOldJava();
        } else {
            setupForge();
        }
    } else if(clientLoaderType === "quilt" || clientLoaderType === "fabric" || clientLoaderType === "vanilla") {
        console.log("setting up new Java")
        setupNewJava();
    }
}


function setupNewJava() {
    console.log("got to the setup")
    if(!fs.existsSync(`${process.env.APPDATA}/warden/java/gamma`)) {
        fs.mkdirSync(`${process.env.APPDATA}/warden/java/gamma`);
        const downloader = new Downloader({
            url: "https://download.oracle.com/java/19/latest/jdk-19_windows-x64_bin.zip",
            directory: `${process.env.APPDATA}/warden/java/gamma`,
            fileName: "jdk-19_windows-x64_bin.zip", //This will be the file name.
            onProgress: function (percentage, chunk, remainingSize) {
                //Gets called with each chunk.
                console.log("javanew | ", percentage + "%");
                obj = {
                    type: "javaNew",
                    task: percentage,
                    total: 100
                }
                fs.writeFileSync(process.env.APPDATA + "/warden/progress.json", JSON.stringify(obj));
                if(obj.task == 100.00) {
                    //timeout
                    setTimeout(function(){
                        unzipJava();
                    }, 5000);                
                }
            }
        })
        try {
            downloader.download();
        } catch (error) {
            console.log(error);
        }
    } else {
        continueToStart();
    }
}

function unzipOldJava() {
    //unzip
    console.log("unzipping")
    try {
        const zip = new AdmZip(`${process.env.APPDATA}/warden/java/copper/OpenJDK8U-jdk.zip`);
        zip.extractAllToAsync(`${process.env.APPDATA}/warden/java/copper/`, true, true, unZippedOld)
    } catch (error) {
        console.error(error.stack)
        console.error("Zipping failed. Reason: %s", error)
        throw new Error(error.message)
    }
}
function unZippedOld() {
    console.log("unzipped")
    fs.unlinkSync(`${process.env.APPDATA}/warden/java/copper/OpenJDK8U-jdk.zip`);
    setTimeout(function(){
        setupForge(); 
    }, 5000);
}

function unzipJava() {
    //unzip
    console.log("unzipping")
    try {
        const zip = new AdmZip(`${process.env.APPDATA}/warden/java/gamma/jdk-19_windows-x64_bin.zip`);
        zip.extractAllToAsync(`${process.env.APPDATA}/warden/java/gamma/`, true, true, unZipped)
    } catch (error) {
        console.error(error.stack)
        console.error("Zipping failed. Reason: %s", error)
        throw new Error(error.message)
    }
}

function unZipped() {
    console.log("unzipped")
    fs.unlinkSync(`${process.env.APPDATA}/warden/java/gamma/jdk-19_windows-x64_bin.zip`);
    setTimeout(function(){
        continueToStart(); 
    }, 5000);
}


function setupForge() {
    if(javaEdition === "Legacy") {
        if(secondaryClientLoaderType === "forgeLegacy") {
            if (!fs.existsSync(process.env.APPDATA + "/warden/forge/forge-"+minecraftVersion+"-"+loaderVersion+"-"+minecraftVersion+"-universal.jar")){
                const fileNN = "forge-"+minecraftVersion+"-"+loaderVersion+"-"+minecraftVersion+"-universal.jar";
                var letsSeeIfThisFixes;
                const downloader = new Downloader({
                    url: "https://maven.minecraftforge.net/net/minecraftforge/forge/"+minecraftVersion+"-"+loaderVersion+"-"+minecraftVersion+"/forge-"+minecraftVersion+"-"+loaderVersion+"-"+minecraftVersion+"-universal.jar",
                    directory: process.env.APPDATA + "/warden/forge",
                    fileName: fileNN, //This will be the file name.
                    onProgress: function (percentage, chunk, remainingSize) {
                        //Gets called with each chunk.
                        obj = {
                            type: "forge",
                            task: percentage,
                            total: 100
                        }
                        console.log(fileNN+" | ", obj.task + "%");
                        fs.writeFileSync(process.env.APPDATA + "/warden/progress.json", JSON.stringify(obj));
                        fs.readdir(process.env.APPDATA + "/warden/forge", (err, files) => {

                            setTimeout(function() {
                                if(obj.task == 100.00 && !letsSeeIfThisFixes) {
                                    console.log("yep!")
                                    sleep(5000);
                                    letsSeeIfThisFixes = true;
                                    continueToStart();
                                }
                            }, 5000);


                            // if(obj.task == 100.00) {
                            //     sleep(5000);
                            //     continueToStart();
                            // }
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
        } else if(secondaryClientLoaderType === "forgeNew") {
            var univOrinst;
            if(minecraftVersion === "1.12.2") univOrinst = "installer"; else univOrinst = "universal";
            console.log(minecraftVersion)
            console.log(univOrinst)
            if (!fs.existsSync(process.env.APPDATA + "/warden/forge/forge-"+minecraftVersion+"-"+loaderVersion+"-"+univOrinst+".jar")){
                const fileNN = "forge-"+minecraftVersion+"-"+loaderVersion+"-"+univOrinst+".jar";
                var letsSeeIfThisFixes;
                const downloader = new Downloader({
                    url: "https://maven.minecraftforge.net/net/minecraftforge/forge/"+minecraftVersion+"-"+loaderVersion+"/forge-"+minecraftVersion+"-"+loaderVersion+"-"+univOrinst+".jar",
                    directory: process.env.APPDATA + "/warden/forge",
                    fileName: fileNN, //This will be the file name.
                    onProgress: function (percentage, chunk, remainingSize) {
                        //Gets called with each chunk.
                        obj = {
                            type: "forge",
                            task: percentage,
                            total: 100
                        }
                        console.log(fileNN+" | ", obj.task + "%");
                        fs.writeFileSync(process.env.APPDATA + "/warden/progress.json", JSON.stringify(obj));
                        fs.readdir(process.env.APPDATA + "/warden/forge", (err, files) => {
                            setTimeout(function() {
                                if(obj.task == 100.00 && !letsSeeIfThisFixes) {
                                    console.log("yep!")
                                    sleep(5000);
                                    letsSeeIfThisFixes = true;
                                    continueToStart();
                                }
                            }, 5000);
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
        }
    } else {
        if (!fs.existsSync(process.env.APPDATA + "/warden/forge/forge-"+minecraftVersion+"-"+loaderVersion+"-"+minecraftVersion+"-installer.jar")){
            const fileNN = "forge-"+minecraftVersion+"-"+loaderVersion+"-"+minecraftVersion+"-installer.jar";
            var letsSeeIfThisFixes;
            const downloader = new Downloader({
                url: "https://maven.minecraftforge.net/net/minecraftforge/forge/"+minecraftVersion+"-"+loaderVersion+"-"+minecraftVersion+"/forge-"+minecraftVersion+"-"+loaderVersion+"-"+minecraftVersion+"-installer.jar",
                directory: process.env.APPDATA + "/warden/forge",
                fileName: fileNN, //This will be the file name.
                onProgress: function (percentage, chunk, remainingSize) {
                    //Gets called with each chunk.
                    obj = {
                        type: "forge",
                        task: percentage,
                        total: 100
                    }
                    console.log(fileNN+" | ", obj.task + "%");
                    fs.writeFileSync(process.env.APPDATA + "/warden/progress.json", JSON.stringify(obj));
                    fs.readdir(process.env.APPDATA + "/warden/forge", (err, files) => {
                        setTimeout(function() {
                            if(obj.task == 100.00 && !letsSeeIfThisFixes) {
                                console.log("yep!")
                                sleep(5000);
                                letsSeeIfThisFixes = true;
                                continueToStart();
                            }
                        }, 5000);
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
    }
}

function continueToStart() {
    var assembler;

    console.log("Starting Minecraft...")

    let opts;
    if(clientLoaderType === "forge" && javaEdition === "Legacy" && secondaryClientLoaderType === "forgeLegacy") {
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
            javaPath: process.env.APPDATA+"\\warden\\java\\copper\\jdk8u352-b08\\bin\\java.exe",
            forge: process.env.APPDATA + "/warden/forge/"+"forge-"+minecraftVersion+"-"+loaderVersion+"-"+minecraftVersion+"-universal.jar",
            version: {
                number: minecraftVersion,
                type: "MCC-Launcher" 
            },
            memory: {
                max: "6G",
                min: "4G"
            },
        }
    }else if(clientLoaderType === "forge" && javaEdition === "Legacy" && secondaryClientLoaderType === "forgeNew") {
        var univOrinst;
        if(minecraftVersion === "1.12.2") univOrinst = "installer"; else univOrinst = "universal";
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
            javaPath: process.env.APPDATA+"\\warden\\java\\copper\\jdk8u352-b08\\bin\\java.exe",
            forge: process.env.APPDATA + "/warden/forge/"+"forge-"+minecraftVersion+"-"+loaderVersion+"-"+univOrinst+".jar",
            version: {
                number: minecraftVersion,
                type: "MCC-Launcher" 
            },
            memory: {
                max: "6G",
                min: "4G"
            },
        }
    } else if(clientLoaderType === "forge" && javaEdition === "Latest") {
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
            javaPath: `${process.env.APPDATA}\\warden\\java\\gamma\\jdk-19.0.1\\bin\\java.exe`,
            forge: process.env.APPDATA + "/warden/forge/"+"forge-"+minecraftVersion+"-"+loaderVersion+"-"+minecraftVersion+"-installer.jar",
            version: {
                number: minecraftVersion,
                type: "MCC-Launcher" 
            },
            memory: {
                max: "6G",
                min: "4G"
            },
        }
    } else if(clientLoaderType === "quilt") {
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
            javaPath: `${process.env.APPDATA}\\warden\\java\\gamma\\jdk-19.0.1\\bin\\java.exe`,
            version: {
                number: minecraftVersion,
                type: "release",
                custom: "quilt-loader-"+loaderVersion+"-"+minecraftVersion
            },
            memory: {
                max: "6G",
                min: "4G"
            },
        }
    }else if(clientLoaderType === "fabric") {
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
            javaPath: `${process.env.APPDATA}\\warden\\java\\gamma\\jdk-19.0.1\\bin\\java.exe`,
            version: {
                number: minecraftVersion,
                type: "release",
                custom: "fabric-loader-"+loaderVersion+"-"+minecraftVersion
            },
            memory: {
                max: "6G",
                min: "4G"
            },
        }
    }else if(clientLoaderType === "vanilla") {
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
            javaPath: `${process.env.APPDATA}\\warden\\java\\gamma\\jdk-19.0.1\\bin\\java.exe`,
            version: {
                number: minecraftVersion,
                type: "release"
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

    if(clientLoaderType === "quilt") {
        assembler = "quilt-loader-"+loaderVersion+"-"+minecraftVersion;
    } else if(clientLoaderType === "forge") {
        assembler = minecraftVersion+"-forge" + minecraftVersion+"-"+loaderVersion+"-"+minecraftVersion;
    } else if(clientLoaderType === "fabric") {
        assembler = "fabric-loader-"+loaderVersion+"-"+minecraftVersion;
    }

    if (!fs.existsSync(minecraftDirectory+"/versions/" + assembler)){
        fs.mkdirSync(minecraftDirectory+"/versions/" + assembler);
    }


    //I NEED TO REWRITE EVERYTHING FROM HERE

    if(clientLoaderType === "forge") {

        const replace = require('replace-in-file');
        if(fs.existsSync(minecraftDirectory+"/options.txt")) {
            const options = {
                files: minecraftDirectory+"/options.txt",
                from: [/gamma:0.0/g],
                to: ["gamma:10.0"]
            };
            replace(options)
            .then(result => {
                console.log("Replacement results: ",result);
            })
            .catch(error => {
                console.log(error);
            });
        }else if (!fs.existsSync(minecraftDirectory+"/options.txt")){
            fs.writeFileSync(minecraftDirectory+"/options.txt", "gamma:10.0");
        }


        

        if(fs.existsSync(minecraftDirectory+"/config")) {
            if(fs.existsSync(minecraftDirectory+"/config/CustomMainMenu")) {
                if(fs.existsSync(minecraftDirectory+"/config/CustomMainMenu/mainmenu.json")) {
                    fs.writeFileSync(minecraftDirectory+"/config/CustomMainMenu/mainmenu.json", "");
                } else {
                    fs.writeFileSync(minecraftDirectory+"/config/CustomMainMenu/mainmenu.json", '{"images":{"title":{"image":"warden:textures/ne.png","posX":-129,"posY":-70,"width":256,"height":260,"alignment":"top_center"}},"buttons":{"singleplayer":{"text":"menu.singleplayer","posX":-100,"posY":48,"width":200,"height":20,"texture":"warden:textures/Button.png","action":{"type":"openGui","gui":"singleplayer"}},"multiplayer":{"text":"menu.multiplayer","posX":-100,"posY":72,"width":200,"height":20,"texture":"warden:textures/Button.png","action":{"type":"openGui","gui":"multiplayer"}},"discord":{"text":"Discord","posX":-100,"posY":107,"width":98,"height":20,"texture":"warden:textures/Short-Button.png","action":{"type":"openLink","link":"https://discord.gg/aATgMp2A"}},"website":{"text":"Website","posX":2,"posY":107,"width":98,"height":20,"texture":"warden:textures/Short-Button.png","action":{"type":"openLink","link":"https://wardenmc.com"}},"options":{"text":"menu.options","posX":-100,"posY":132,"width":98,"height":20,"texture":"warden:textures/Short-Button.png","action":{"type":"openGui","gui":"options"}},"quit":{"text":"menu.quit","posX":2,"posY":132,"width":98,"height":20,"texture":"warden:textures/Short-Button.png","action":{"type":"quit"}}},"labels":{"mojang":{"text":"Copyright Mojang AB. Do not distribute!","posX":-197,"posY":-10,"color":-1,"alignment":"bottom_right"},"version":{"text":"1.8.9","posX":2,"posY":-20,"color":-1,"alignment":"bottom_left"},"warden":{"text":"Super powered by WardenMC","posX":2,"posY":-10,"color":-1,"alignment":"bottom_left"}},"other":{"background":{"image":"warden:textures/background.png","mode":"fill"}}}');
                }
            } else {
                fs.mkdirSync(minecraftDirectory+"/config/CustomMainMenu");
            }

            if(fs.existsSync(minecraftDirectory+"/config/splash.properties")) {
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
            } else if (!fs.existsSync(minecraftDirectory+"/config/splash.properties")){
                fs.writeFileSync(minecraftDirectory+"/config/splash.properties", "enabled=false");
            }
        } else {
            fs.mkdirSync(minecraftDirectory+"/config");
            fs.mkdirSync(minecraftDirectory+"/config/CustomMainMenu");

            if(fs.existsSync(minecraftDirectory+"/config/CustomMainMenu/mainmenu.json")) {
                fs.writeFileSync(minecraftDirectory+"/config/CustomMainMenu/mainmenu.json", '{"images":{"title":{"image":"warden:textures/ne.png","posX":-129,"posY":-70,"width":256,"height":260,"alignment":"top_center"}},"buttons":{"singleplayer":{"text":"menu.singleplayer","posX":-100,"posY":48,"width":200,"height":20,"texture":"warden:textures/Button.png","action":{"type":"openGui","gui":"singleplayer"}},"multiplayer":{"text":"menu.multiplayer","posX":-100,"posY":72,"width":200,"height":20,"texture":"warden:textures/Button.png","action":{"type":"openGui","gui":"multiplayer"}},"discord":{"text":"Discord","posX":-100,"posY":107,"width":98,"height":20,"texture":"warden:textures/Short-Button.png","action":{"type":"openLink","link":"https://discord.gg/aATgMp2A"}},"website":{"text":"Website","posX":2,"posY":107,"width":98,"height":20,"texture":"warden:textures/Short-Button.png","action":{"type":"openLink","link":"https://wardenmc.com"}},"options":{"text":"menu.options","posX":-100,"posY":132,"width":98,"height":20,"texture":"warden:textures/Short-Button.png","action":{"type":"openGui","gui":"options"}},"quit":{"text":"menu.quit","posX":2,"posY":132,"width":98,"height":20,"texture":"warden:textures/Short-Button.png","action":{"type":"quit"}}},"labels":{"mojang":{"text":"Copyright Mojang AB. Do not distribute!","posX":-197,"posY":-10,"color":-1,"alignment":"bottom_right"},"version":{"text":"1.8.9","posX":2,"posY":-20,"color":-1,"alignment":"bottom_left"},"warden":{"text":"Super powered by WardenMC","posX":2,"posY":-10,"color":-1,"alignment":"bottom_left"}},"other":{"background":{"image":"warden:textures/background.png","mode":"fill"}}}');
            } else {
                fs.writeFileSync(minecraftDirectory+"/config/CustomMainMenu/mainmenu.json", '{"images":{"title":{"image":"warden:textures/ne.png","posX":-129,"posY":-70,"width":256,"height":260,"alignment":"top_center"}},"buttons":{"singleplayer":{"text":"menu.singleplayer","posX":-100,"posY":48,"width":200,"height":20,"texture":"warden:textures/Button.png","action":{"type":"openGui","gui":"singleplayer"}},"multiplayer":{"text":"menu.multiplayer","posX":-100,"posY":72,"width":200,"height":20,"texture":"warden:textures/Button.png","action":{"type":"openGui","gui":"multiplayer"}},"discord":{"text":"Discord","posX":-100,"posY":107,"width":98,"height":20,"texture":"warden:textures/Short-Button.png","action":{"type":"openLink","link":"https://discord.gg/aATgMp2A"}},"website":{"text":"Website","posX":2,"posY":107,"width":98,"height":20,"texture":"warden:textures/Short-Button.png","action":{"type":"openLink","link":"https://wardenmc.com"}},"options":{"text":"menu.options","posX":-100,"posY":132,"width":98,"height":20,"texture":"warden:textures/Short-Button.png","action":{"type":"openGui","gui":"options"}},"quit":{"text":"menu.quit","posX":2,"posY":132,"width":98,"height":20,"texture":"warden:textures/Short-Button.png","action":{"type":"quit"}}},"labels":{"mojang":{"text":"Copyright Mojang AB. Do not distribute!","posX":-197,"posY":-10,"color":-1,"alignment":"bottom_right"},"version":{"text":"1.8.9","posX":2,"posY":-20,"color":-1,"alignment":"bottom_left"},"warden":{"text":"Super powered by WardenMC","posX":2,"posY":-10,"color":-1,"alignment":"bottom_left"}},"other":{"background":{"image":"warden:textures/background.png","mode":"fill"}}}');
            }


            if(fs.existsSync(minecraftDirectory+"/config/splash.properties")) {
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
            } else if (!fs.existsSync(minecraftDirectory+"/config/splash.properties")){
                fs.writeFileSync(minecraftDirectory+"/config/splash.properties", "enabled=false");
            }
        }
    }

    //TO HERE

    if(clientLoaderType === "quilt") {
        if (!fs.existsSync(minecraftDirectory+"/versions/" + assembler+"/"+assembler+".json")){
            const file = fs.createWriteStream(minecraftDirectory+"/versions/" + assembler+"/"+assembler+".json");
            if(minecraftVersion === "1.18.2") {
                file.write('{"id":"quilt-loader-0.17.0-beta.2-1.18.2","inheritsFrom":"1.18.2","releaseTime":"2022-06-01T17:17:38+0000","time":"2022-06-01T17:17:38+0000","type":"release","mainClass":"org.quiltmc.loader.impl.launch.knot.KnotClient","arguments":{"game":[]},"libraries":[{"name":"net.fabricmc:tiny-mappings-parser:0.3.0+build.17","url":"https://maven.fabricmc.net/"},{"name":"net.fabricmc:sponge-mixin:0.11.2+mixin.0.8.5","url":"https://maven.fabricmc.net/"},{"name":"net.fabricmc:tiny-remapper:0.8.1","url":"https://maven.fabricmc.net/"},{"name":"net.fabricmc:access-widener:2.1.0","url":"https://maven.fabricmc.net/"},{"name":"org.quiltmc:quilt-json5:1.0.1","url":"https://maven.quiltmc.org/repository/release/"},{"name":"org.ow2.asm:asm:9.3","url":"https://maven.fabricmc.net/"},{"name":"org.ow2.asm:asm-analysis:9.3","url":"https://maven.fabricmc.net/"},{"name":"org.ow2.asm:asm-commons:9.3","url":"https://maven.fabricmc.net/"},{"name":"org.ow2.asm:asm-tree:9.3","url":"https://maven.fabricmc.net/"},{"name":"org.ow2.asm:asm-util:9.3","url":"https://maven.fabricmc.net/"},{"name":"net.fabricmc:intermediary:1.18.2","url":"https://maven.fabricmc.net/"},{"name":"org.quiltmc:quilt-loader:0.17.0-beta.2","url":"https://maven.quiltmc.org/repository/release/"}]}', 'utf8');
            } else if(minecraftVersion === "1.19") {
                file.write('{"id":"quilt-loader-0.17.0-beta.2-1.19","inheritsFrom":"1.19","releaseTime":"2022-06-07T15:50:41+0000","time":"2022-06-07T15:50:41+0000","type":"release","mainClass":"org.quiltmc.loader.impl.launch.knot.KnotClient","arguments":{"game":[]},"libraries":[{"name":"net.fabricmc:tiny-mappings-parser:0.3.0+build.17","url":"https://maven.fabricmc.net/"},{"name":"net.fabricmc:sponge-mixin:0.11.2+mixin.0.8.5","url":"https://maven.fabricmc.net/"},{"name":"net.fabricmc:tiny-remapper:0.8.1","url":"https://maven.fabricmc.net/"},{"name":"net.fabricmc:access-widener:2.1.0","url":"https://maven.fabricmc.net/"},{"name":"org.quiltmc:quilt-json5:1.0.1","url":"https://maven.quiltmc.org/repository/release/"},{"name":"org.ow2.asm:asm:9.3","url":"https://maven.fabricmc.net/"},{"name":"org.ow2.asm:asm-analysis:9.3","url":"https://maven.fabricmc.net/"},{"name":"org.ow2.asm:asm-commons:9.3","url":"https://maven.fabricmc.net/"},{"name":"org.ow2.asm:asm-tree:9.3","url":"https://maven.fabricmc.net/"},{"name":"org.ow2.asm:asm-util:9.3","url":"https://maven.fabricmc.net/"},{"name":"org.quiltmc:hashed:1.19","url":"https://maven.quiltmc.org/repository/release/"},{"name":"org.quiltmc:quilt-loader:0.17.0-beta.2","url":"https://maven.quiltmc.org/repository/release/"}]}', 'utf8');
            }
        }
    } else if(clientLoaderType === "fabric") {
        if (!fs.existsSync(minecraftDirectory+"/versions/" + assembler+"/"+assembler+".json")){
            const file = fs.createWriteStream(minecraftDirectory+"/versions/" + assembler+"/"+assembler+".json");
            //https://meta.fabricmc.net/v2/versions/loader/22w42a/0.14.10/profile/json
            fetch(`https://meta.fabricmc.net/v2/versions/loader/${minecraftVersion}/${loaderVersion}/profile/json`)
            .then(res => res.json())
            .then(json => {
                file.write(JSON.stringify(json), 'utf8');
            });

            // if(clientLoaderType === "fabric" && minecraftVersion === "1.19") {
            //     file.write('{"id":"fabric-loader-0.14.6-1.19","inheritsFrom":"1.19","releaseTime":"2022-06-07T15:10:13+0000","time":"2022-06-07T15:10:13+0000","type":"release","mainClass":"net.fabricmc.loader.impl.launch.knot.KnotClient","arguments":{"game":[],"jvm":["-DFabricMcEmu= net.minecraft.client.main.Main "]},"libraries":[{"name":"net.fabricmc:tiny-mappings-parser:0.3.0+build.17","url":"https://maven.fabricmc.net/"},{"name":"net.fabricmc:sponge-mixin:0.11.4+mixin.0.8.5","url":"https://maven.fabricmc.net/"},{"name":"net.fabricmc:tiny-remapper:0.8.2","url":"https://maven.fabricmc.net/"},{"name":"net.fabricmc:access-widener:2.1.0","url":"https://maven.fabricmc.net/"},{"name":"org.ow2.asm:asm:9.3","url":"https://maven.fabricmc.net/"},{"name":"org.ow2.asm:asm-analysis:9.3","url":"https://maven.fabricmc.net/"},{"name":"org.ow2.asm:asm-commons:9.3","url":"https://maven.fabricmc.net/"},{"name":"org.ow2.asm:asm-tree:9.3","url":"https://maven.fabricmc.net/"},{"name":"org.ow2.asm:asm-util:9.3","url":"https://maven.fabricmc.net/"},{"name":"net.fabricmc:intermediary:1.19","url":"https://maven.fabricmc.net/"},{"name":"net.fabricmc:fabric-loader:0.14.6","url":"https://maven.fabricmc.net/"}]}', 'utf8')
            // } else if(clientLoaderType === "fabric" && minecraftVersion === "22w42a"){
            //     file.write('{"id":"fabric-loader-0.14.10-22w42a","inheritsFrom":"22w42a","releaseTime":"2022-10-19T22:51:07+0000","time":"2022-10-19T22:51:07+0000","type":"release","mainClass":"net.fabricmc.loader.impl.launch.knot.KnotClient","arguments":{"game":[],"jvm":["-DFabricMcEmu= net.minecraft.client.main.Main "]},"libraries":[{"name":"net.fabricmc:tiny-mappings-parser:0.3.0+build.17","url":"https://maven.fabricmc.net/"},{"name":"net.fabricmc:sponge-mixin:0.11.4+mixin.0.8.5","url":"https://maven.fabricmc.net/"},{"name":"net.fabricmc:tiny-remapper:0.8.2","url":"https://maven.fabricmc.net/"},{"name":"net.fabricmc:access-widener:2.1.0","url":"https://maven.fabricmc.net/"},{"name":"org.ow2.asm:asm:9.3","url":"https://maven.fabricmc.net/"},{"name":"org.ow2.asm:asm-analysis:9.3","url":"https://maven.fabricmc.net/"},{"name":"org.ow2.asm:asm-commons:9.3","url":"https://maven.fabricmc.net/"},{"name":"org.ow2.asm:asm-tree:9.3","url":"https://maven.fabricmc.net/"},{"name":"org.ow2.asm:asm-util:9.3","url":"https://maven.fabricmc.net/"},{"name":"net.fabricmc:intermediary:22w42a","url":"https://maven.fabricmc.net/"},{"name":"net.fabricmc:fabric-loader:0.14.10","url":"https://maven.fabricmc.net/"}]}', 'utf8')
            // }
        }
    }
    console.log("starting starting minecraft")
    console.log(finalOpts)
    launcher.launch(finalOpts);
    //launcher.on('progress', (e) => fs.writeFileSync(process.env.APPDATA + "/warden/progress.json", JSON.stringify(e)));
    launcher.on('progress', (e) => { fs.writeFileSync(process.env.APPDATA + "/warden/progress.json", JSON.stringify(e)); console.log(e) });
    // launcher.on('debug', (e) => console.log(e));
    launcher.on('data', (e) => console.log(e));

    //when launched
    launcher.on('close', (e) => {
        console.log("MC CLOSED. IDK IF IT WAS A CRASH OR NOT. ILL FIGURE THAT OUT LATER")
    });

    launcher.on('arguments', (e) => {
        console.log("HERE IS WHERE WE SHOULD CLOSE THE APP BUT IDK HOW TO DO THAT RN SO ITS GONNA BE IN v0.7.0")
    });
}