"use strict";
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
Object.defineProperty(exports, "__esModule", { value: true });
var node_path_1 = require("node:path");
var fs = require("node:fs");
var args = process.argv.slice(2);
var workdir = process.cwd();
console.log(workdir);
if (args.some(function (e) { return /^--workdir=*./.test(e); })) {
    workdir = (_b = (_a = args.find(function (a) { return a.includes("--workdir="); })) === null || _a === void 0 ? void 0 : _a.replace("--workdir=", "")) !== null && _b !== void 0 ? _b : "";
}
if (args.includes("--create-config-mysql")) {
    var fileLocationRaw = args.find(function (a) { return a.includes('--location='); });
    var fileLocation = fileLocationRaw ? fileLocationRaw.replace("--location=", "") : "./";
    var fullPath = fileLocation.startsWith(".") ? node_path_1.default.join(workdir, fileLocation) : fileLocation;
    var host = (_d = (_c = args.find(function (a) { return a.includes('--host='); })) === null || _c === void 0 ? void 0 : _c.replace('--host=', '')) !== null && _d !== void 0 ? _d : "";
    var port = (_f = (_e = args.find(function (a) { return a.includes('--port='); })) === null || _e === void 0 ? void 0 : _e.replace('--port=', '')) !== null && _f !== void 0 ? _f : "";
    var user = (_h = (_g = args.find(function (a) { return a.includes('--user='); })) === null || _g === void 0 ? void 0 : _g.replace('--user=', '')) !== null && _h !== void 0 ? _h : "";
    var password = (_k = (_j = args.find(function (a) { return a.includes('--password='); })) === null || _j === void 0 ? void 0 : _j.replace('--password=', '')) !== null && _k !== void 0 ? _k : "";
    var database = (_m = (_l = args.find(function (a) { return a.includes('--database='); })) === null || _l === void 0 ? void 0 : _l.replace('--database=', '')) !== null && _m !== void 0 ? _m : "";
    var fullPathWithFile = node_path_1.default.join(fullPath, "mynodeorm-mysql-config.json");
    if (fs.existsSync(fullPathWithFile)) {
        fs.unlinkSync(fullPathWithFile);
    }
    var config = {
        mysql: {
            host: host,
            port: port,
            user: user,
            password: password,
            database: database
        }
    };
    fs.writeFileSync(fullPathWithFile, JSON.stringify(config), { encoding: "utf8" });
    var schemaScriptPath = node_path_1.default.join(fullPath, "mynodeorm-migration-config.js");
    var migrationsScript = "\n    const dbClasses = [];\n  ";
    fs.writeFileSync(schemaScriptPath, migrationsScript, { encoding: "utf8" });
    console.log("Config file created and saved at " + fullPathWithFile + ".");
}
if (args.includes("--migration")) {
    if (!args.some(function (e) { return /^--name=*./.test(e); })) {
        throw Error("Name is required for a migration. Use '--name={{name}}' to declare a name of this migration.");
    }
    var name_1 = (_p = (_o = args.find(function (a) { return a.includes('--name='); })) === null || _o === void 0 ? void 0 : _o.replace('--name=', '')) !== null && _p !== void 0 ? _p : "";
    var migrationLocationPath = (_r = (_q = args.find(function (a) { return a.includes('--migration-location='); })) === null || _q === void 0 ? void 0 : _q.replace('--migration-location=', '')) !== null && _r !== void 0 ? _r : "./";
    var migrationLocation = node_path_1.default.join(process.cwd(), migrationLocationPath, "migrations");
    var configurationLocationPath = (_t = (_s = args.find(function (a) { return a.includes('--config-location='); })) === null || _s === void 0 ? void 0 : _s.replace('--config-location=', '')) !== null && _t !== void 0 ? _t : "./";
    var configurationLocation = node_path_1.default.join(process.cwd(), configurationLocationPath, "mynodeorm-migration-config.js");
    if (!fs.existsSync(configurationLocation)) {
        console.log("Configuration not found on location ".concat(configurationLocation));
        process.exit(1);
    }
    var firstMigration = false;
    if (!fs.existsSync(migrationLocation)) {
        firstMigration = true;
        console.log("Migration location does not exists... Creating folder.");
        fs.mkdirSync(migrationLocation, { recursive: true });
    }
    var version = 10;
    var migrationName = getDateFormat() + (version > 0 ? (".".concat(version)) : "") + "_" + name_1;
    var dbClasses = require(configurationLocation).dbClasses;
    console.log(dbClasses);
}
function getDateFormat() {
    var date = new Date();
    var year = date.getFullYear()
        .toString();
    var month = (date.getMonth() + 1).toString();
    var day = date.getDate()
        .toString();
    return year + month + day;
}
