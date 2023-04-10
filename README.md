# WardenMC
Warden is a new and modern Minecraft Client/Launcher. When using Warden, you will notice higher FPS and an overall smoother experience due to the customizations Warden has. In addition, newer versions of Warden have support for modpacks through a new system called "Layouts"!


# Layouts
Layout's are Warden's custom solution to modpacks. Using Warden v0.7.0 snapshots or later, Layouts can be loaded into Warden via .json file in the "layouts" folder in warden's %appdata% folder.
Here are some example layouts:

```json
{
	"overwriteOptimizations":  false,
	"metaData": { 
		"name":  "[MODPACK NAME]",
		"version":  [MODPACK VERSION (example: 1)],
		"minecraftVersion":  "[MINECRAFT VERSION (example: 1.12.2)]",
		"secondaryMinecraftVersion":  "[SECONDARY MINECRAFT VERSION (example: 1.12)]",
		"clientLoaderType":  "[MINECRAFT CLIENT TYPE (example: forge)]",
		"secondaryClientLoaderType":  "[SECONDARY MINECRAFT CLIENT TYPE (example: forgeNew)]",
		"loaderVersion":  "[VERSION OF THE CLIENT TYPE]",
		"javaVersionRequired":  "[JAVA VERSION]"
	},
	"mods": [
		{  "name":  "[MODNAME]",  "id":  "[MOD ID]",  "site":  "[SITE (curseforge or modrinth)]"  }
	]
}
```
NOTES:
1) the "version" property is not a string and instead an int. This means the value should not be surrounded by quotation marks. You also cannot use decimals in the version number.
2) "secondaryClientLoaderType" is where things can get tricky and it is recommended you join the discord for more help!
3) When adding mods, the "site" property can also take the parameter "url"(as opposed to "curseforge" or "modrinth") in which case you would put the mod's download url in the "id" field

# Ghostberry
[Ghostberry](https://ghostberry.net) is a unified profile system developed by me and allows for expanded functionality. With Warden, you can link your Warden launcher to a Ghostberry profile by:
1) Going to [ghostberry.net](https://ghostberry.net) and logging in on a desktop
2) Then, in the nav bar, click "View your Ghost"
3) Make sure the Warden launcher is open on your computer
4) Click the Link button for Warden! You can then follow the prompts to open in Warden
5) Your Ghostberry profile is now linked!

With Ghostberry linked you can now get exclusive cosmetics, add friends (coming soon), and more! You will even notice a new Ghostberry badge on your Ghostberry profile (ghostberry.net/user/[Ghostberry Username])
