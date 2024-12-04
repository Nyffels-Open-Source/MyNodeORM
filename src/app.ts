#! /usr/bin/env node
import path from "node:path";
import * as fs from "node:fs";
import {
  getAllProperties,
  getAutoIncrement,
  getColumn,
  getDefaultSql,
  getNullable,
  getPrimary,
  getSqlType,
  getTable,
  getType,
  getUnique,
  getUnsigned
} from "./decorators";
import {Schema} from "./models/schema.models";
import {mkdirSync} from "fs";
import {MigrationFileBuilder} from "./models/migration.models";


const args = process.argv.slice(2);
let workdir = process.cwd();
if (args.some(e => /^--workdir=*./.test(e))) {
  workdir = args.find(a => a.includes("--workdir="))
    ?.replace("--workdir=", "") ?? "";
}
console.log(`• Working from ${workdir}.`);

if (args.includes("--create-config-mysql")) {
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
    console.log(`• MySql config file already exists. Delete existing one...`);
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
  console.log("• MySQL config file created and saved at " + fullPathWithFile + ".");

  const schemaScriptPath = path.join(fullPath, "mynodeorm-migration-config.ts");
  if (fs.existsSync(schemaScriptPath)) {
    console.log(`• Schema config file already exists. Delete existing one...`);
    fs.unlinkSync(schemaScriptPath);
  }

  let migrationsScript = `
    export const dbClasses = [];
  `;
  fs.writeFileSync(schemaScriptPath, migrationsScript, {encoding: "utf8"});
  console.log("✅ Schema config file created and saved at " + fullPathWithFile + ".");
} else if (args.includes("--migration")) {
  if (!args.some(e => /^--name=*./.test(e))) {
    console.error("❌ Name is required for a migration. Use '--name={{name}}' to declare a name of this migration.");
    process.exit(1);
  }

  const name = args.find((a) => a.includes('--name='))
    ?.replace('--name=', '') ?? "";

  const migrationLocationPath = args.find((a) => a.includes('--migration-location='))
    ?.replace('--migration-location=', '') ?? "./";
  const migrationLocation = path.join(process.cwd(), migrationLocationPath, "migrations");

  const configurationLocationPath = args.find((a) => a.includes('--config-location='))
    ?.replace('--config-location=', '') ?? "./";
  const configurationLocation = path.join(process.cwd(), configurationLocationPath, "mynodeorm-migration-config.ts");

  if (!fs.existsSync(configurationLocation)) {
    console.error(`❌ Configuration not found on location ${configurationLocation}`);
    process.exit(1);
  }

  let firstMigration = false;
  if (!fs.existsSync(migrationLocation)) {
    firstMigration = true;
    console.log("• Migration location does not exists... Creating folder.");
    fs.mkdirSync(migrationLocation, {recursive: true});
  }

  if (!firstMigration) {
    const folders = fs.readdirSync(migrationLocation);
    firstMigration = folders.length == 0;
  }

  const version = 10;
  const migrationName = getDateFormat() + (version > 0 ? (`.${version}`) : "") + "_" + name;

  const dbClasses = require(configurationLocation).dbClasses;

  console.log("• Creating schema...");
  const schema: Schema = {};
  for (const dbClass of dbClasses) {
    const table = getTable(dbClass);
    if (!table) { continue; }
    
    schema[table] = {
      columns: {}
    };
    
    const properties = getAllProperties(dbClass);
    for (let property of properties) {
      schema[table].columns[getColumn(dbClass, property)] = {
        type: getSqlType(dbClass, property),
        primary: getPrimary(dbClass, property),
        nullable: getNullable(dbClass, property),
        unique: getUnique(dbClass, property),
        unsigned: getUnsigned(dbClass, property),
        autoIncrement: getAutoIncrement(dbClass, property),
        defaultSql: getDefaultSql(dbClass, property) ?? null,
        foreignKey: null // TODO
      };
    }
  }
  
  mkdirSync(path.join(migrationLocation, migrationName), {recursive: true});
  fs.writeFileSync(path.join(migrationLocation, migrationName, "schema.json"), JSON.stringify(schema));

  console.log("• Schema created.");

  if (firstMigration) {
    console.log("• Creating migration file...");
    let migrationFileContent = MigrationFileBuilder.GetFileTemplate();

    migrationFileContent = migrationFileContent.replace("{{{{TEMPLATE-DATA-DOWN}}}}", "// This is the first migration. To undo this, delete your database!");

    let uplogic = ''; // TODO Create up logic
    migrationFileContent = migrationFileContent.replace("{{{{TEMPLATE-DATA-UP}}}}", uplogic);

    fs.writeFileSync(path.join(migrationLocation, migrationName, "migration-plan.ts"), migrationFileContent);
    console.log("• Migration file created.");
  } else {
    console.log("• Creating migration file...");
    let migrationFileContent = MigrationFileBuilder.GetFileTemplate();

    let downlogic = ''; // TODO Create up logic
    let uplogic = ''; // TODO Create up logic

    migrationFileContent = migrationFileContent.replace("{{{{TEMPLATE-DATA-DOWN}}}}", downlogic);
    migrationFileContent = migrationFileContent.replace("{{{{TEMPLATE-DATA-UP}}}}", uplogic);

    fs.writeFileSync(path.join(migrationLocation, migrationName, "migration-plan.ts"), migrationFileContent);
    console.log("• Migration file created.");
  }

  console.log("✅  Migration completed.");
} else {
  console.error("❌ No valid action found!");
  process.exit(1);
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