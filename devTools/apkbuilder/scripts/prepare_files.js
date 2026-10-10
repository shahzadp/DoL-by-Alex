/*
 * update and patch files that will go into the built apk
 */
const fs = require('fs-extra');
const path = require('path');

const sourcePath = path.resolve('../..'); // assume we're in gameDir/devTools/apkbuilder
const sourceDirs = ["img"]; // it's almost universally just img
const sourceName = "Degrees of Lewdity.html"; // game's compiled html
const targetPath = path.resolve('./platforms/android/app/src/main/assets/www');
const targetName = "index.html";

// before anything else, move saved sourceDirs to www
const tmp = path.resolve("tmp");
sourceDirs.forEach(dir => {
    const savedDir = path.resolve(tmp, dir);
    const targetDir = path.resolve(targetPath, dir);
    if (fs.existsSync(savedDir)) fs.moveSync(savedDir, targetDir);
})

let counter = 0; // files copied/updated
let skipCounter = 0; // files skipped
let delCounter = 0; // files removed
// recursively copy files from src to dest, preserving timestamps and skipping copy if file already exists and timestamps match
function syncCopy(src, dest, options) {
    //console.log("entry", src, dest);
    if (!fs.existsSync(src)) return console.log("syncCopy fail: source doesn't exist: ", src);
    if (fs.statSync(src).isDirectory()) {
        fs.ensureDirSync(dest); // make sure dest exists, create it if it doesn't
        const srcFiles = fs.readdirSync(src); // files in source dir
        const destFiles = fs.readdirSync(dest); // files in dest dir
        const absentFiles = destFiles.filter(f => !srcFiles.includes(f)); // files to remove from dest dir because they were removed from src dir
        // console.log("wawawa", absentFiles);
        for (const file of absentFiles) {
            fs.rmSync(path.resolve(dest, file), { recursive: true });
            delCounter++;
        }
        for (const file of srcFiles) syncCopy(path.resolve(src, file), path.resolve(dest, file), options);
    }
    // note: copied files' .mtimeMs are preserved with ms precision, but .mtimeMs can have ns precision, requiring rounding
    else if (!fs.existsSync(dest) || Math.round(fs.statSync(src).mtimeMs) !== Math.round(fs.statSync(dest).mtimeMs)) {
        counter++
        fs.cpSync(src, dest, {dereference: true, preserveTimestamps: true});
    }
    else skipCounter++;
}
sourceDirs.forEach(dir => syncCopy(path.resolve(sourcePath, dir), path.resolve(targetPath, dir)))
console.log(`copied ${counter} files, skipped ${skipCounter} files that don't need updating, and removed ${delCounter} files not present in sourceDirs`);

// copy html and update it to include and make use of selected scripts
const sourceHtml = path.resolve(sourcePath, sourceName);
const targetHtml = path.resolve(targetPath, targetName);
if (!fs.existsSync(sourceHtml)) throw new Error(`game is not compiled: ${sourceHtml} not found`);

const injection = '<script src="cordova.js" type="text/javascript"></script>\n<script src="custom_cordova_additions.js" type="text/javascript"></script>\n<script ';
const raw = fs.readFileSync(sourceHtml, "utf-8");
if (!raw.includes('<script ')) {
    // if the compiled html ever changes shape, fail the build loudly rather than
    // shipping an apk whose game never loads cordova.js
    throw new Error(`could not find a <script> tag to inject the cordova scripts into ${sourceHtml}`);
}
const updatedData = raw
    .replace('<script ', injection)
    .replace(/saveAs\(/g, 'cordova.plugins.saveDialog.saveFile(');
fs.writeFileSync(targetHtml, updatedData, "utf-8");
console.log(`wrote ${targetHtml}`);
