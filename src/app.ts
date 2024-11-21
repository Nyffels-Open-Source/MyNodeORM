import path from "path";
import fs from 'fs';
import _ from "lodash";

const args = process.argv.slice(2);
let workdir = process.cwd();
console.log(workdir);
if (args.some(e => /^--workdir=*./.test(e))) {
  workdir = args.find(a => a.includes("--workdir="))
    ?.replace("--workdir=", "") ?? "";
}

if (args.includes("--create-config")) {
  const fileLocationRaw = args.find(a => a.includes('--location='));
  const fileLocation = fileLocationRaw ? fileLocationRaw.replace("--location=", "") : "./";
  const fullPath = fileLocation.startsWith(".") ? path.join(workdir, fileLocation) : fileLocation;

  const host = args.find((a) => a.includes('--host='))
    ?.replace('--host=', '') ?? "";
  const port = args.find((a) => a.includes('--port='))
    ?.replace('--port=', '') ?? "";
  const user = args.find((a) => a.includes('--user='))
    ?.replace('--user=', '') ?? "";
  const password = args.find((a) => a.includes('--password='))
    ?.replace('--password=', '') ?? "";
  const database = args.find((a) => a.includes('--database='))
    ?.replace('--database=', '') ?? "";

  const fullPathWithFile = path.join(fullPath, "mynodeorm-mysql-config.json");
  if (fs.existsSync(fullPathWithFile)) {
    fs.unlinkSync(fullPathWithFile);
  }

  const config = {
    mysql: {
      host: host,
      port: port,
      user: user,
      password: password,
      database: database
    }
  }
  fs.writeFileSync(fullPathWithFile, JSON.stringify(config), {encoding: "utf8"});

  const schemaScriptPath = path.join(fullPath, "mynodeorm-migration-config.js");
  let migrationsScript = `
    const dbClasses = [];
  `;
  fs.writeFileSync(schemaScriptPath, migrationsScript, {encoding: "utf8"});
}

if (args.includes("--migration")) {
  if (!args.some(e => /^--name=*./.test(e))) {
    throw Error("Name is required for a migration. Use '--name={{name}}' to declare a name of this migration.");
  }

  const name = args.find((a) => a.includes('--name='))
    ?.replace('--name=', '') ?? "";
  
  // Check if name exists 
  // if name not exists version is 1
  // if name exists version is version + 1
  const version = 10;
  const migrationName = getDateFormat() + (version > 0 ? (`.${version}`) : "") + "_" + name;

  console.log(migrationName);
}

function getDateFormat() {
  const date = new Date();
  const year = date.getFullYear()
    .toString();
  const month = (date.getMonth() + 1).toString();
  const day = date.getDate()
    .toString();

  return year + month + day;
}