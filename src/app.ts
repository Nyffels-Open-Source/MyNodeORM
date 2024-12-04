#! /usr/bin/env node
import path from "node:path";
import * as fs from "node:fs";
import {
  autoIncrement,
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

  const schemaScriptPath = path.join(fullPath, "mynodeorm-migration-config.ts");
  if (fs.existsSync(schemaScriptPath)) {
    console.log(`• Schema config file already exists. Delete existing one...`);
    fs.unlinkSync(schemaScriptPath);
  }

  // TODO Auto populate dbClasses

  let migrationsScript = `
    export const dbClasses = [];
  `;
  fs.writeFileSync(schemaScriptPath, migrationsScript, {encoding: "utf8"});
  console.log("✅ Schema config file created and saved at " + schemaScriptPath + ".");
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
  
  if (!fs.existsSync(migrationLocation)) {
    console.log("• Migration location does not exists... Creating folder.");
    fs.mkdirSync(migrationLocation, {recursive: true});
  }

  const folders = fs.readdirSync(migrationLocation, { withFileTypes: true }).filter(f => f.isDirectory()).map(f => f.name);
  let version = 0;
  if (folders.length > 0) {
    version = folders.map(f => +f.split(".")[0]).sort().reverse()[0] + 1;
  }
  const migrationName = `${version}.${getDateFormat()}_${name}`;

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
      const type = getType(dbClass, property);

      schema[table].columns[getColumn(dbClass, property)] = {
        type: getSqlType(dbClass, property),
        primary: getPrimary(dbClass, property),
        nullable: getNullable(dbClass, property),
        unique: getUnique(dbClass, property),
        unsigned: ['number', 'bignumber'].includes(type) ? getUnsigned(dbClass, property) : false,
        autoIncrement: getAutoIncrement(dbClass, property),
        defaultSql: getDefaultSql(dbClass, property) ?? null,
        foreignKey: null // TODO
      };
    }
  }

  fs.writeFileSync(path.join(migrationLocation, "schema.json"), JSON.stringify(schema));

  console.log("• Schema created.");

  if (version === 0) {
    console.log("• Creating migration file...");
    let migrationFileContent = MigrationFileBuilder.GetFileTemplate();

    migrationFileContent = migrationFileContent.replace("{{{{TEMPLATE-DATA-DOWN}}}}", "");

    let uplogic = '';
    Object.keys(schema)
      .forEach((table, index) => {
        if (index != 0) {
          uplogic += `\n\n        `;
        }
        uplogic += `const table_${index} = this._builder.addTable('${table}');\n`;

        Object.keys(schema[table].columns)
          .forEach((column, cIndex) => {
            if (cIndex !== 0) {
              uplogic += `\n`
            }
            const sColumn = schema[table].columns[column];
            uplogic += `        table_${index}.addColumn('${column}', '${sColumn.type}')`;
            
            if (sColumn.primary) {
              uplogic += `.primary()`;
            }
            if (sColumn.nullable) {
              uplogic += `.nullable()`;
            }
            if (sColumn.unique) {
              uplogic += `.unique()`;
            }
            if (sColumn.unsigned) {
              uplogic += `.unsigned()`;
            }
            if (sColumn.autoIncrement) {
              uplogic += `.autoIncrement()`;
            }
            if ((sColumn.defaultSql ?? "").trim().length > 0) {
              uplogic += `.defaultSql('${sColumn.defaultSql}')`;
            }
            uplogic += `;`;
          })
      });

    uplogic += `\n\n        this._builder.execute();`;
    
    migrationFileContent = migrationFileContent.replace("{{{{TEMPLATE-DATA-UP}}}}", uplogic);

    mkdirSync(path.join(migrationLocation, migrationName), {recursive: true});
    fs.writeFileSync(path.join(migrationLocation, migrationName, "migration-plan.ts"), migrationFileContent);
    console.log("• Migration file created.");
  } else {
    console.log("• Creating migration file...");
    console.log(migrationLocation);
    const oldSchema = fs.readFileSync(path.join(migrationLocation, "schema.json")).toString();
    
    let migrationFileContent = MigrationFileBuilder.GetFileTemplate();

    let downlogic = ''; // TODO Create up logic
    let uplogic = ''; // TODO Create up logic

    migrationFileContent = migrationFileContent.replace("{{{{TEMPLATE-DATA-DOWN}}}}", downlogic);
    migrationFileContent = migrationFileContent.replace("{{{{TEMPLATE-DATA-UP}}}}", uplogic);

    mkdirSync(path.join(migrationLocation, migrationName), {recursive: true});
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