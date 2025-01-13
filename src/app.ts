#! /usr/bin/env node
import path from "node:path";
import * as fs from "node:fs";
import {getAllProperties, getAutoIncrement, getColumn, getDefaultSql, getNullable, getPrimary, getSqlType, getTable, getType, getUnique, getUnsigned} from "./decorators/index.js";
import {Schema} from "./models/schema.models.js";
import {mkdirSync} from "fs";
import {MigrationFileBuilder} from "./models/index.js";
import {isEqual} from 'lodash-es';
import mysql, {RowDataPacket} from "mysql2/promise";


const args = process.argv.slice(2);
let workdir = process.cwd();
if (args.some(e => /^--workdir=*./.test(e))) {
  workdir = args.find(a => a.includes("--workdir="))
    ?.replace("--workdir=", "") ?? "";
}
console.log(`• Working from ${workdir}.`);

if (args.includes("--create-config")) {
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

  const folders = fs.readdirSync(migrationLocation, {withFileTypes: true})
    .filter(f => f.isDirectory())
    .map(f => f.name);
  let version = 0;
  let oldSchema!: Schema;
  if ((folders).length > 0) {
    // @ts-ignore
    version = (folders.map(f => +f.split(".")[0])
      .sort()
      .reverse()[0]) + 1;
    oldSchema = JSON.parse(fs.readFileSync(path.join(migrationLocation, "schema.json"))
      .toString());
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

    migrationFileContent = migrationFileContent.replace("{{{{TEMPLATE-DATA-DOWN}}}}", "// First migration plan starts from empty database, down should mean destroy database. Database not empty? Use rebase function for integration of existing database to the migration flow.");

    let uplogic = '';
    Object.keys(schema)
      .forEach((table, index) => {
        if (index != 0) {
          uplogic += `\n\n        `;
        }
        uplogic += `const table_${index} = this._builder.addTable('${table}');\n`;

        // @ts-ignore
        Object.keys(schema[table].columns)
          .forEach((column, cIndex) => {
            if (cIndex !== 0) {
              uplogic += `\n`
            }
            // @ts-ignore
            const sColumn = schema[table].columns[column];
            // @ts-ignore
            uplogic += `        table_${index}.addColumn('${column}', '${sColumn.type}')`;

            // @ts-ignore
            if (sColumn.primary) {
              uplogic += `.primary()`;
            }
            // @ts-ignore
            if (sColumn.nullable) {
              uplogic += `.nullable()`;
            }
            // @ts-ignore
            if (sColumn.unique) {
              uplogic += `.unique()`;
            }
            // @ts-ignore
            if (sColumn.unsigned) {
              uplogic += `.unsigned()`;
            }
            // @ts-ignore
            if (sColumn.autoIncrement) {
              uplogic += `.autoIncrement()`;
            }
            // @ts-ignore
            if ((sColumn.defaultSql ?? "").trim().length > 0) {
              // @ts-ignore
              uplogic += `.defaultSql('${sColumn.defaultSql}')`;
            }
            uplogic += `;`;
          });

        uplogic += `\n\n        table_${index}.commit();`;
      });
    uplogic += `\n\n        await this._builder.execute();`;

    migrationFileContent = migrationFileContent.replace("{{{{TEMPLATE-DATA-UP}}}}", uplogic);

    mkdirSync(path.join(migrationLocation, migrationName), {recursive: true});
    fs.writeFileSync(path.join(migrationLocation, migrationName, "migration-plan.ts"), migrationFileContent);
    console.log("• Migration file created.");
  } else {
    console.log("• Creating migration file...");
    let migrationFileContent = MigrationFileBuilder.GetFileTemplate();

    let downlogic = ''; // TODO Create up logic
    let uplogic = ''; // TODO Create up logic

    if (isEqual(oldSchema, schema)) {
      const oldSchemaTables = Object.keys(oldSchema);
      const schemaTables = Object.keys(schema);

      const addedTables = schemaTables.filter(t => oldSchemaTables.indexOf(t) < 0);
      const removedTables = oldSchemaTables.filter(t => schemaTables.indexOf(t) < 0);
      const existingTables = schemaTables.filter(t => !addedTables.concat(removedTables)
        .includes(t));

      let isFirstEntry = true;
      let tIndex = 0;

      (addedTables ?? []).forEach((table) => {
        if (!isFirstEntry) {
          uplogic += `\n\n        `;
          downlogic += `\n\n        `;
        } else {
          isFirstEntry = false;
        }

        uplogic += `const table_${tIndex} = this._builder.addTable('${table}');\n`;

        // @ts-ignore
        Object.keys(schema[table].columns)
          .forEach((column, cIndex) => {
            if (cIndex !== 0) {
              uplogic += `\n`
            }
            // @ts-ignore
            const sColumn = schema[table].columns[column];
            // @ts-ignore
            uplogic += `        table_${tIndex}.addColumn('${column}', '${sColumn.type}')`;

            // @ts-ignore
            if (sColumn.primary) {
              uplogic += `.primary()`;
            }
            // @ts-ignore
            if (sColumn.nullable) {
              uplogic += `.nullable()`;
            }
            // @ts-ignore
            if (sColumn.unique) {
              uplogic += `.unique()`;
            }
            // @ts-ignore
            if (sColumn.unsigned) {
              uplogic += `.unsigned()`;
            }
            // @ts-ignore
            if (sColumn.autoIncrement) {
              uplogic += `.autoIncrement()`;
            }
            // @ts-ignore
            if ((sColumn.defaultSql ?? "").trim().length > 0) {
              // @ts-ignore
              uplogic += `.defaultSql('${sColumn.defaultSql}')`;
            }
            uplogic += `;`;
          });

        downlogic += `this._builder.dropTable('${table}')`;

        tIndex += 1;
      });

      (removedTables ?? []).forEach((table) => {
        if (!isFirstEntry) {
          uplogic += `\n\n        `;
          downlogic += `\n\n        `;
        } else {
          isFirstEntry = false;
        }

        downlogic += `const table_${tIndex} = this._builder.addTable('${table}');\n`;

        // @ts-ignore
        Object.keys(oldSchema[table].columns)
          .forEach((column, cIndex) => {
            if (cIndex !== 0) {
              downlogic += `\n`
            }
            // @ts-ignore
            const sColumn = oldSchema[table].columns[column];
            // @ts-ignore
            downlogic += `        table_${tIndex}.addColumn('${column}', '${sColumn.type}')`;

            // @ts-ignore
            if (sColumn.primary) {
              downlogic += `.primary()`;
            }
            // @ts-ignore
            if (sColumn.nullable) {
              downlogic += `.nullable()`;
            }
            // @ts-ignore
            if (sColumn.unique) {
              downlogic += `.unique()`;
            }
            // @ts-ignore
            if (sColumn.unsigned) {
              downlogic += `.unsigned()`;
            }
            // @ts-ignore
            if (sColumn.autoIncrement) {
              downlogic += `.autoIncrement()`;
            }
            // @ts-ignore
            if ((sColumn.defaultSql ?? "").trim().length > 0) {
              // @ts-ignore
              downlogic += `.defaultSql('${sColumn.defaultSql}')`;
            }
            downlogic += `;`;
          });

        uplogic += `this._builder.dropTable('${table}')`;

        tIndex += 1;
      });

      if (uplogic.trim().length > 0) {
        uplogic += `\n\n        this._builder.execute();`;
      }
      if (downlogic.trim().length > 0) {
        downlogic += `\n\n        this._builder.execute();`;
      }
    } else {
      console.log("⚠ Schema has no differences. Creating empty migration file...");
    }

    migrationFileContent = migrationFileContent.replace("{{{{TEMPLATE-DATA-DOWN}}}}", downlogic);
    migrationFileContent = migrationFileContent.replace("{{{{TEMPLATE-DATA-UP}}}}", uplogic);

    mkdirSync(path.join(migrationLocation, migrationName), {recursive: true});
    fs.writeFileSync(path.join(migrationLocation, migrationName, "migration-plan.ts"), migrationFileContent);
    console.log("• Migration file created.");
  }

  console.log("✅  Migration completed.");
} else if (args.includes("--migrate")) {
  // TODO
} else if (args.includes("--generate-integration-script")) {
  const runIntegration = async () => {
    const connectionstringRaw = args.find(a => a.includes('--connectionstring='));
    if (!connectionstringRaw) {
      throw Error("Connection string is missing and is required.");
    }
    
    const connectionstring = connectionstringRaw.replace("--connectionstring=", "");
    const server = (/Server=(.*?)(;|$)/.exec(connectionstring) ?? [])[1];
    const port = (/Port=(.*?)(;|$)/.exec(connectionstring) ?? [])[1];
    const database = (/Database=(.*?)(;|$)/.exec(connectionstring) ?? [])[1];
    const password = (/Pwd=(.*?)(;|$)/.exec(connectionstring) ?? [])[1];
    const user = (/Uid=(.*?)(;|$)/.exec(connectionstring) ?? [])[1];

    const connection = await mysql.createConnection({
      host: server,
      port: port ? +port : 3306,
      database: database,
      user: user,
      password: password,
    });

    /* Build current state schema */
    const schema: Schema = {};

    const [tablesRes] = await connection.query("SHOW TABLES;");
    const tables = (tablesRes as RowDataPacket[]).map(x => x[`Tables_in_${database}`]);
    for (const table of tables) {
      schema[table] = {columns: {}};

      const [columns] = await connection.query(`DESCRIBE ${table};`);
      const [indexes] = await connection.query(`SHOW INDEXES FROM ${table};`);
      for (const column of (columns as { Field: string; Type: string, Null: "YES" | "NO", Key: "PRI" | "UNI" | "MUL", Default: string, Extra: string }[])) {
        const index = (indexes as { Table: string; Non_unique: boolean; Key_name: string; Seq_in_index: boolean; Column_name: string; Null: string, Visible: "YES" | "NO" }[]).filter(e => e.Column_name == column.Field);
        const isUnique = !!index.find(e => !e.Non_unique);

        schema[table].columns[column.Field] = {
          type: column.Type.replace(" unsigned", ""),
          primary: column.Key == "PRI",
          nullable: column.Null == "YES",
          unique: isUnique,
          unsigned: column.Type.includes("unsigned"),
          autoIncrement: column.Extra.includes("auto_increment"),
          defaultSql: column.Default,
          foreignKey: null // TODO
        }
      }
    }

    /* Load migration schema */
    
    const migrationLocationPath = args.find((a) => a.includes('--migration-location='))
      ?.replace('--migration-location=', '') ?? "./";
    const migrationLocation = path.join(process.cwd(), migrationLocationPath, "migrations");
    const migrationSchema = JSON.parse(fs.readFileSync(path.join(migrationLocation, "schema.json"))
      .toString());
    
    /* Compare current schema to migration schema with script creation */
    const scriptLines: string[] = []
    const currentTables = Object.keys(schema);
    const migrationTables = Object.keys(migrationSchema);
    
    const droptables = currentTables.filter(e => !migrationTables.includes(e));
    const addtables = migrationTables.filter(e => !currentTables.includes(e));
    const updateTables = currentTables.filter(e => migrationTables.includes(e));

    for (const table of droptables) {
      scriptLines.push(`DROP TABLE ${table};`);
    }
    
    // TODO Add tables 
    // TODO Check tables for updates
    // TODO Save version to integrated table 
    
    /* Save the script */
    const saveLocationPath = args.find((a) => a.includes('--output='))
      ?.replace('--output=', '') ?? "./";
    const saveLocation = path.join(process.cwd(), saveLocationPath, "integration-script.sql");
    fs.writeFileSync(saveLocation, scriptLines.join('\n'));
    
    return;
  }
  runIntegration()
    .then(() => {
      console.log("✅ Integration script created.");
      process.exit(1);
    });
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