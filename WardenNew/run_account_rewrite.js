const { Client } = require('minecraft-launcher-core');
const Downloader = require("nodejs-file-downloader");
const launcher = new Client();
const msmc = require("msmc");
const fs = require('fs');
const fetch = require('node-fetch');
const {Modrinth} = require("modrinth")
var AdmZip = require("adm-zip");
const replace = require('replace-in-file');

var minecraftVersion;
var secondaryMCVersion;
var clientLoaderType;
var secondaryClientLoaderType;
var loaderVersion;
var javaEdition;
var source;
var layoutName;
console.log(process.argv)
var passedArguments = (process.argv[2]).split(',');
console.log(passedArguments);

minecraftVersion = passedArguments[0]
secondaryMCVersion = passedArguments[1]
clientLoaderType = passedArguments[2]
secondaryClientLoaderType = passedArguments[3]
loaderVersion = passedArguments[4]
javaEdition = passedArguments[5]
source = passedArguments[6]
layoutName = passedArguments[7]
const modrinth = new Modrinth({
    authorization: "" 
});

let MethodGETSettings = { method: "Get" };

const auth = fs.readFileSync(process.env.APPDATA + "/warden/auth/auth.json");
const parsedAuthProfile = JSON.parse(auth);
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

const defaultWardenSettings = {
    "closeWardenOnMCLaunch": false,
    "discordRPC":true,
    "wardenModConfigVersion": "0",
    "gammaEdit": "10.0",
    "maxRam":"6"
}

if(!fs.existsSync(process.env.APPDATA + "/warden/settings.json")) fs.writeFileSync(process.env.APPDATA + "/warden/settings.json", JSON.stringify(defaultWardenSettings));

const wardenSettingsFile = JSON.parse(fs.readFileSync(process.env.APPDATA + "/warden/settings.json"));

checkValidAuth();

function checkValidAuth() {
    var auth_profile = fs.readFileSync(process.env.APPDATA + "/warden/auth/auth_profile.json");
    const parsedAuthProfile = JSON.parse(auth_profile);
    const isValid = msmc.validate(parsedAuthProfile);

    if(isValid) {
        console.log("Valid auth")
        setupMods();
    } else {
        msmc.refresh(parsedAuthProfile).then(async newProfile => {
            console.log(newProfile);
            if(newProfile.reason === "Could not log into Microsoft" && newProfile.translationString === "Login.Fail.MS") {
                console.log("Invalid");

                fs.unlinkSync(process.env.APPDATA + "/warden/auth/auth_profile.json");
                fs.unlinkSync(process.env.APPDATA + "/warden/auth/auth.json");

            } else {
                console.log("valid")
                setupMods();
            }
        }).catch(err => {
            console.log(err);
        });
    }
}




function setupMods() {

    if(!fs.existsSync(process.env.APPDATA + "/warden/minecraft/mods")) fs.mkdirSync(process.env.APPDATA + "/warden/minecraft/mods", { recursive: true });
    fetch("https://api.persn.dev/warden/getMods", MethodGETSettings)
        .then(res => res.json())
        .then((json) => {
            var tables;
            if(source === "official") tables = json.entries[minecraftVersion];
            if(source === "layout") tables = JSON.parse(fs.readFileSync(process.env.APPDATA + "/warden/layouts/" + layoutName)).mods;
            console.log(json.entries[minecraftVersion])

            if(wardenSettingsFile.wardenModConfigVersion !== json.version && source === "official") {
                console.log("theres been an update to the mod config, deleting all mods")
                wardenSettingsFile.wardenModConfigVersion = json.version;
                fs.writeFileSync(process.env.APPDATA + "/warden/settings.json", JSON.stringify(wardenSettingsFile));
                fs.rmSync(process.env.APPDATA + "/warden/minecraft/mods", { recursive: true })
                fs.mkdirSync(process.env.APPDATA + "/warden/minecraft/mods");
                console.log("deleted all mods due to outdated mod config")
            }
            
            fs.readdir(process.env.APPDATA + "/warden/minecraft/" + "/mods", (err, files) => {
                if(!tables || files.length != tables.length) {
                    console.log("checking")
                    if(fs.existsSync(process.env.APPDATA + "/warden/minecraft/mods")) {
                        fs.rmSync(process.env.APPDATA + "/warden/minecraft/mods", { recursive: true })
                        fs.mkdirSync(process.env.APPDATA + "/warden/minecraft/mods");
                    }
                } else {
                    console.log("User had correct amount of mods");
                    checkForJava();
                }
            });


            if(tables) {
                //there are mods to download
                var modsDownloaded = [];
                tables.forEach(function(table) {
                    var modID = table.id;
                    var modNAME = table.name;
                    var modSITE = table.site;

                    if(modSITE === "modrinth") {
                        modrinth.mod(modNAME).then(async mod => {
                            const url = await mod.versions().catch(err => {console.log(err)});
                            let arrayOfModTimestamps = [];
                            for (let step = 0; step < url.length; step++) {
                                if((url[step]._source.loaders.includes(clientLoaderType) || url[step]._source.loaders.includes(secondaryClientLoaderType)) && (url[step]._source.game_versions.includes(minecraftVersion) || url[step]._source.game_versions.includes(secondaryMCVersion))) {
                                    arrayOfModTimestamps.push(url[step]._source.date_published);
                                }
                            }
                            arrayOfModTimestamps.sort();
                            const finalURL = Object.values(url).filter(user => user._source.date_published === arrayOfModTimestamps.at(-1));
                            
                            if (!fs.existsSync(process.env.APPDATA + "/warden/minecraft/mods/"+finalURL[0].files[0].filename)){
                                const downloader = new Downloader({
                                    url: finalURL[0].files[0].url,
                                    directory: process.env.APPDATA + "/warden/minecraft/mods",
                                    fileName: finalURL[0].files[0].filename,
                                    cloneFiles: false,
                                    onProgress: (percentage, chunk, totalReceived) => {
                                        obj = {
                                            type: "modification",
                                            task: percentage,
                                            total: 100
                                        }
                                        fs.writeFileSync(process.env.APPDATA + "/warden/progress.json", JSON.stringify(obj));
                                    }
                                });
                                try {
                                    downloader.download().then(function(){
                                        //add to modsDownloaded
                                        modsDownloaded.push(finalURL[0].files[0].filename);
                                        console.log(modsDownloaded)
                                        if(modsDownloaded.length === tables.length) {
                                            console.log("Finished Downloading Mods");
                                            checkForJava();
                                        } else {
                                            console.log("Downloaded " + modsDownloaded.length + " out of " + tables.length + " mods")
                                        }
                                    });
                                } catch (error) {
                                    console.log(error);
                                }
                            }
                        });
                    } else if(modSITE === "curseforge") {

                        fetch(`https://api.persn.dev/curseforge/${modID}`)
                            .then(res => res.json())
                            .then(json => {
                                let timestampsArray = []
                                for (let step = 0; step < json.data.length; step++) {
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
                                    if(finalURL[0].downloadUrl == null || finalURL[0].downloadUrl == undefined) {
                                        console.log("No file found for " + modNAME);
                                    } else {
                                        var urlforfilename = finalURL[0].downloadUrl;
                                        var finalFilename = urlforfilename.substring(urlforfilename.lastIndexOf('/')+1);
                                        if (!fs.existsSync(process.env.APPDATA+"/warden/minecraft/mods/"+finalFilename)){
                                            const downloader = new Downloader({
                                                url: finalURL[0].downloadUrl,
                                                directory: process.env.APPDATA + "/warden/minecraft/mods",
                                                fileName: finalFilename,
                                                cloneFiles: false,
                                                onProgress: (percentage, chunk, totalReceived) => {
                                                    obj = {
                                                        type: "modification",
                                                        task: percentage,
                                                        total: 100
                                                    }
                                                    fs.writeFileSync(process.env.APPDATA + "/warden/progress.json", JSON.stringify(obj));
                                                }
                                            });
                                            try {
                                                downloader.download().then(function(){
                                                    console.log("FINAL URL:   "+finalURL)
                                                    modsDownloaded.push(finalFilename);
                                                    console.log(modsDownloaded)
                                                    if(modsDownloaded.length === tables.length) {
                                                        console.log("Finished Downloading Mods");
                                                        checkForJava();
                                                    } else {
                                                        console.log("Downloaded " + modsDownloaded.length + " out of " + tables.length + " mods")
                                                    }
                                                });
                                            } catch (error) {
                                                console.log(error);
                                            }
                                        }
                                    }
                                }, 1000)
                            });


                    } else if(modSITE === "url") {
                        if (!fs.existsSync(process.env.APPDATA + "/warden/minecraft/mods/"+modNAME+".jar")) {
                            const downloader = new Downloader({
                                url: modID,
                                directory: process.env.APPDATA + "/warden/minecraft/mods",
                                fileName: modNAME+".jar",
                                cloneFiles: false,
                                onProgress: (percentage, chunk, totalReceived) => {
                                    obj = {
                                        type: "modification",
                                        task: percentage,
                                        total: 100
                                    }
                                    fs.writeFileSync(process.env.APPDATA + "/warden/progress.json", JSON.stringify(obj));
                                }
                            });
                            try {
                                downloader.download().then(function(){
                                    //add to modsDownloaded
                                    modsDownloaded.push(modNAME+".jar");
                                    console.log(modsDownloaded)
                                    if(modsDownloaded.length === tables.length) {
                                        console.log("Finished Downloading Mods");
                                        checkForJava();
                                    } else {
                                        console.log("Downloaded " + modsDownloaded.length + " out of " + tables.length + " mods")
                                    }
                                });
                            } catch (error) {
                                console.log(error);
                            }
                        }
                    }
                });

            } else {
                console.log("No mods to download")
                checkForJava();
            }
        });
    
    
    
    // checkForJava();
}

function checkForJava() {
    if(javaEdition === "Legacy") {
        console.log("Legacy Java")
        if(!fs.existsSync(process.env.APPDATA + "/warden/java/copper")) {
            fs.mkdirSync(process.env.APPDATA + "/warden/java/copper", { recursive: true });
            console.log("Created Copper Java Folder | Didnt have it previously")
            const downloader = new Downloader({
                url: "https://github.com/adoptium/temurin8-binaries/releases/download/jdk8u352-b08/OpenJDK8U-jdk_x64_windows_hotspot_8u352b08.zip",
                directory: process.env.APPDATA + "/warden/java/copper",
                fileName: "OpenJDK8U-jdk.zip",
                cloneFiles: false,
                onProgress: (percentage, chunk, totalReceived) => {
                    obj = {
                        type: "javaCopper",
                        task: percentage,
                        total: 100
                    }
                    fs.writeFileSync(process.env.APPDATA + "/warden/progress.json", JSON.stringify(obj));
                }
            });
            try {
                downloader.download().then(function(){
                    //completed!
                    unzipJava();
                    console.log("Downloaded Copper Java")
                });
            } catch (error) {
                console.log(error);
            }
        } else {
            console.log("Copper Java Folder already exists")
            setupModLoader();
        }
    } else if(javaEdition === "Latest") {
        console.log("Latest Java")
        if(!fs.existsSync(process.env.APPDATA + "/warden/java/gamma")) {
            fs.mkdirSync(process.env.APPDATA + "/warden/java/gamma", { recursive: true });
            console.log("Created Gamma Java Folder | Didnt have it previously")
            
            const downloader = new Downloader({
                url: "https://download.oracle.com/java/19/latest/jdk-19_windows-x64_bin.zip",
                directory: process.env.APPDATA + "/warden/java/gamma",
                fileName: "jdk-19_windows-x64_bin.zip",
                cloneFiles: false,
                onProgress: (percentage, chunk, totalReceived) => {
                    obj = {
                        type: "javaGamma",
                        task: percentage,
                        total: 100
                    }
                    fs.writeFileSync(process.env.APPDATA + "/warden/progress.json", JSON.stringify(obj));
                }
            });
            try {
                downloader.download().then(function(){
                    console.log("Downloaded Gamma Java");
                    unzipJava();
                });
            } catch (error) {
                console.log(error);
            }
        } else {
            console.log("Gamma Java Folder already exists")
            setupModLoader();
        }
    }
}

function unzipJava() {
    //unzip
    var javaCodeName;
    var javaFileName;

    if(javaEdition === "Legacy") javaCodeName = "copper";
    if(javaEdition === "Latest") javaCodeName = "gamma";

    if(javaEdition === "Legacy") javaFileName = "OpenJDK8U-jdk.zip";
    if(javaEdition === "Latest") javaFileName = "jdk-19_windows-x64_bin.zip";

    // setTimeout(() => {
        try {
            console.log(javaFileName)
            const zip = new AdmZip(`${process.env.APPDATA}/warden/java/${javaCodeName}/${javaFileName}`);
            zip.extractAllToAsync(`${process.env.APPDATA}/warden/java/${javaCodeName}/`, true, true, unZipped)
        } catch (error) {
            console.error(error.stack)
            console.error("Zipping failed. Reason: %s", error)
            throw new Error(error.message)
        }
    // }, 5000);
}

function unZipped() {
    var javaCodeName;
    var javaFileName;

    if(javaEdition === "Legacy") javaCodeName = "copper";
    if(javaEdition === "Latest") javaCodeName = "gamma";

    if(javaEdition === "Legacy") javaFileName = "OpenJDK8U-jdk.zip";
    if(javaEdition === "Latest") javaFileName = "jdk-19_windows-x64_bin.zip";
    

    fs.unlinkSync(`${process.env.APPDATA}/warden/java/${javaCodeName}/${javaFileName}`);
    setTimeout(function(){
        setupModLoader();
    }, 1000);
}


function setupModLoader() {

    if(clientLoaderType === "forge") {
        if(javaEdition === "Legacy") {
            if(secondaryClientLoaderType === "forgeLegacy") {
                if (!fs.existsSync(process.env.APPDATA + "/warden/forge/forge-"+minecraftVersion+"-"+loaderVersion+"-"+minecraftVersion+"-universal.jar")){
                    const downloader = new Downloader({
                        url:`https://maven.minecraftforge.net/net/minecraftforge/forge/${minecraftVersion}-${loaderVersion}-${minecraftVersion}/forge-${minecraftVersion}-${loaderVersion}-${minecraftVersion}-universal.jar`,
                        directory:  process.env.APPDATA + "/warden/forge",
                        fileName: `forge-${minecraftVersion}-${loaderVersion}-${minecraftVersion}-universal.jar`,
                        cloneFiles: false,
                        onProgress: (percentage, chunk, totalReceived) => {
                            obj = {
                                type: "forgeLegacy",
                                task: percentage,
                                total: 100
                            }
                            fs.writeFileSync(process.env.APPDATA + "/warden/progress.json", JSON.stringify(obj));
                        }
                    });
                    try {
                        downloader.download().then(function(){
                            wardenEdits();
                            console.log("Downloaded Forge Legacy")
    
                        });
                    } catch (error) {
                        console.log(error);
                    }
                } else {
                    wardenEdits();
                }
            } else if(secondaryClientLoaderType === "forgeNew") {
                var univOrinst;
                if(minecraftVersion === "1.12.2") univOrinst = "installer"; else univOrinst = "universal";
                if (!fs.existsSync(process.env.APPDATA + "/warden/forge/forge-"+minecraftVersion+"-"+loaderVersion+"-"+univOrinst+".jar")){
                    const downloader = new Downloader({
                        url: `https://maven.minecraftforge.net/net/minecraftforge/forge/${minecraftVersion}-${loaderVersion}/forge-${minecraftVersion}-${loaderVersion}-${univOrinst}.jar`,
                        directory:  process.env.APPDATA + "/warden/forge",
                        fileName: `forge-${minecraftVersion}-${loaderVersion}-${univOrinst}.jar`,
                        cloneFiles: false,
                        onProgress: (percentage, chunk, totalReceived) => {
                            obj = {
                                type: "forgeNew",
                                task: percentage,
                                total: 100
                            }
                            fs.writeFileSync(process.env.APPDATA + "/warden/progress.json", JSON.stringify(obj));
                        }
                    });
                    try {
                        downloader.download().then(function(){
                            wardenEdits();
                            console.log("Downloaded Forge New")
                        });
                    } catch (error) {
                        console.log(error);
                    }
                } else {
                    wardenEdits();
                }

            }
        } else if(javaEdition === "Latest") {
            if (!fs.existsSync(process.env.APPDATA + "/warden/forge/forge-"+minecraftVersion+"-"+loaderVersion+"-"+minecraftVersion+"-installer.jar")){
                const downloader = new Downloader({
                    url: `https://maven.minecraftforge.net/net/minecraftforge/forge/${minecraftVersion}-${loaderVersion}-${minecraftVersion}/forge-${minecraftVersion}-${loaderVersion}-${minecraftVersion}-installer.jar`,
                    directory:  process.env.APPDATA + "/warden/forge",
                    fileName: `forge-${minecraftVersion}-${loaderVersion}-${minecraftVersion}-installer.jar`,
                    cloneFiles: false,
                    onProgress: (percentage, chunk, totalReceived) => {
                        obj = {
                            type: "forge",
                            task: percentage,
                            total: 100
                        }
                        fs.writeFileSync(process.env.APPDATA + "/warden/progress.json", JSON.stringify(obj));
                    }
                });
                try {
                    downloader.download().then(function(){
                        wardenEdits();
                        console.log("Downloaded Forge for Latest Java")
                    });
                } catch (error) {
                    console.log(error);
                }
            } else {
                wardenEdits();
            }

        } else {
            console.log("Edition of Java isn't set")
        }

    } else if(clientLoaderType === "fabric") {
        console.log("Fabric Not Set Up Yet")
        wardenEdits();
    }
}



function wardenEdits() {
    console.log(wardenSettingsFile.gammaEdit)

    try {
        fs.writeFileSync(process.env.APPDATA+"/warden/minecraft/config/customwindowtitle-client.toml", 'title = "WardenMC | {mcversion}"', {recursive: true});
    } catch (err) {
        console.error(err);
    }

    if(fs.existsSync(process.env.APPDATA+"/warden/minecraft/options.txt")) {
        const options = {
            files: process.env.APPDATA+"/warden/minecraft/options.txt",
            from: [/.*(gamma).*/g],
            to: [`gamma:${wardenSettingsFile.gammaEdit}`]
        };
        replace(options).then(result => {
            console.log("Replacement results: ",result);
            start();
        })
        .catch(error => {
            console.log(error);
        });
    } else {
        fs.writeFileSync(process.env.APPDATA+"/warden/minecraft/options.txt", `gamma:${wardenSettingsFile.gammaEdit}`);
        start();
    }
}

function start() {
    var assembler;
    if (!fs.existsSync(process.env.APPDATA+"/warden/minecraft/versions")) fs.mkdirSync(process.env.APPDATA+"/warden/minecraft/versions", { recursive: true });

    if(clientLoaderType === "quilt") {
        assembler = "quilt-loader-"+loaderVersion+"-"+minecraftVersion;
    } else if(clientLoaderType === "forge") {
        assembler = minecraftVersion+"-forge" + minecraftVersion+"-"+loaderVersion+"-"+minecraftVersion;
    } else if(clientLoaderType === "fabric") {
        assembler = "fabric-loader-"+loaderVersion+"-"+minecraftVersion;
    }
    if (!fs.existsSync(process.env.APPDATA+"/warden/minecraft/versions/" + assembler)) fs.mkdirSync(process.env.APPDATA+"/warden/minecraft/versions/" + assembler, { recursive: true });
    if(clientLoaderType === "fabric") {
        if (!fs.existsSync(process.env.APPDATA+"/warden/minecraft/versions/" + assembler+"/"+assembler+".json")){
            const file = fs.createWriteStream(process.env.APPDATA+"/warden/minecraft/versions/" + assembler+"/"+assembler+".json");
            fetch(`https://meta.fabricmc.net/v2/versions/loader/${minecraftVersion}/${loaderVersion}/profile/json`)
            .then(res => res.json())
            .then(json => {
                file.write(JSON.stringify(json), 'utf8');
            });
        }
    }

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
            root: process.env.APPDATA+"/warden/minecraft",
            javaPath: process.env.APPDATA+"\\warden\\java\\copper\\jdk8u352-b08\\bin\\java.exe",
            forge: process.env.APPDATA + "/warden/forge/"+"forge-"+minecraftVersion+"-"+loaderVersion+"-"+minecraftVersion+"-universal.jar",
            version: {
                number: minecraftVersion,
                type: "MCC-Launcher" 
            },
            memory: {
                max: `${wardenSettingsFile.maxRam}G`,
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
            root: process.env.APPDATA+"/warden/minecraft",
            javaPath: process.env.APPDATA+"\\warden\\java\\copper\\jdk8u352-b08\\bin\\java.exe",
            forge: process.env.APPDATA + "/warden/forge/"+"forge-"+minecraftVersion+"-"+loaderVersion+"-"+univOrinst+".jar",
            version: {
                number: minecraftVersion,
                type: "MCC-Launcher" 
            },
            memory: {
                max: `${wardenSettingsFile.maxRam}G`,
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
            root: process.env.APPDATA+"/warden/minecraft",
            javaPath: `${process.env.APPDATA}\\warden\\java\\gamma\\jdk-19.0.1\\bin\\java.exe`,
            forge: process.env.APPDATA + "/warden/forge/"+"forge-"+minecraftVersion+"-"+loaderVersion+"-"+minecraftVersion+"-installer.jar",
            version: {
                number: minecraftVersion,
                type: "MCC-Launcher" 
            },
            memory: {
                max: `${wardenSettingsFile.maxRam}G`,
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
            root: process.env.APPDATA+"/warden/minecraft",
            javaPath: `${process.env.APPDATA}\\warden\\java\\gamma\\jdk-19.0.1\\bin\\java.exe`,
            version: {
                number: minecraftVersion,
                type: "release",
                custom: "quilt-loader-"+loaderVersion+"-"+minecraftVersion
            },
            memory: {
                max: `${wardenSettingsFile.maxRam}G`,
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
            root: process.env.APPDATA+"/warden/minecraft",
            javaPath: `${process.env.APPDATA}\\warden\\java\\gamma\\jdk-19.0.1\\bin\\java.exe`,
            version: {
                number: minecraftVersion,
                type: "release",
                custom: "fabric-loader-"+loaderVersion+"-"+minecraftVersion
            },
            memory: {
                max: `${wardenSettingsFile.maxRam}G`,
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
            root: process.env.APPDATA+"/warden/minecraft",
            javaPath: `${process.env.APPDATA}\\warden\\java\\gamma\\jdk-19.0.1\\bin\\java.exe`,
            version: {
                number: minecraftVersion,
                type: "release"
            },
            memory: {
                max: `${wardenSettingsFile.maxRam}G`,
                min: "4G"
            },
        }
    }

    let finalOpts = opts;

    console.log("Starting Minecraft")
    launcher.launch(finalOpts);
    launcher.on('progress', (e) => { fs.writeFileSync(process.env.APPDATA + "/warden/progress.json", JSON.stringify(e)); console.log(e) });
    launcher.on('data', (e) => {
        console.log(e);
        obj = {
            type: "Launching Minecraft",
            task: 100,
            total: 100
        } 
        fs.writeFileSync(process.env.APPDATA + "/warden/progress.json", JSON.stringify(obj));
    });
}

