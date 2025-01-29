#! /usr/bin/env node
import path from "node:path";
import * as fs from "node:fs";
import {Schema} from "./models/schema.models.js";
import mysql, {RowDataPacket} from "mysql2/promise";
import {createRequire} from 'module';
import {add, uniq} from "lodash-es";

const require = createRequire(import.meta.url);
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

  const schemaScriptPath = path.join(fullPath, "mynodeorm-migration.ts");
  if (fs.existsSync(schemaScriptPath)) {
    console.log(`• Schema config file already exists. Delete existing one...`);
    fs.unlinkSync(schemaScriptPath);
  }

  // TODO Scan for classes?

  let migrationsScript = `
    import {createMigration} from '@nyffels/mynodeorm/dist/logic/migration.logic.js';
    
    const classes = [
      /* Enter the classes you wish to include */
    ]
    
    const args = process.argv.slice(2);
    if (!args.some(e => /^--name=*./.test(e))) {
        console.error("❌ Name is required for a migration. Use '--name={{name}}' to declare a name of this migration.");
        process.exit(1);
    }
    const name = args.find((a) => a.includes('--name='))?.replace('--name=', '') ?? "";
    const migrationLocationPath = args.find((a) => a.includes('--migration-location='))?.replace('--migration-location=', '') ?? "./";
    createMigration(name, migrationLocationPath, classes);
  `;
  fs.writeFileSync(schemaScriptPath, migrationsScript, {encoding: "utf8"});
  console.log("✅ Schema config file created and saved at " + schemaScriptPath + ".");
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
        const isUnique = !!index.find(e => !e.Non_unique && e.Key_name != "PRIMARY");

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
    if (!fs.existsSync(migrationLocation)) {
      throw new Error(`Migration location '${migrationLocation}' not found.`);
    }

    const latestMigrationVersion = fs.readdirSync(migrationLocation, {withFileTypes: true})
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort()
      .reverse()
      .find(x => x);
    const migrationSchema = JSON.parse(fs.readFileSync(path.join(migrationLocation, "schema.json"))
      .toString()) as Schema;


    if (migrationSchema === undefined) {
      console.error("Migration schema not found");
    }

    /* Compare current schema to migration schema with script creation */
    const scriptLines: string[] = [`USE ${database};`]
    const currentTables = Object.keys(schema);
    const migrationTables = Object.keys(migrationSchema);

    const droptables = currentTables.filter(e => !migrationTables.includes(e));
    const addtables = migrationTables.filter(e => !currentTables.includes(e));
    const updateTables = currentTables.filter(e => migrationTables.includes(e));

    for (const table of droptables) {
      scriptLines.push(`DROP TABLE ${table};`);
    }

    for (const table of addtables) {
      const tableSchema = migrationSchema[table]?.columns;
      if (tableSchema === undefined) {
        continue;
      }

      const columnSql: string[] = [];
      const primaryColumns: string[] = [];
      const uniqueColumns: string[] = [];
      for (const column of Object.keys(tableSchema)) {
        const data = tableSchema[column];
        if (data == null) {
          continue;
        }

        let sql = "";
        sql += `${column} ${data.type}`;
        if (data.unsigned) {
          sql += ` UNSIGNED`;
        }
        sql += ` ${data.nullable ? 'NULL' : 'NOT NULL'}`;
        if (data.defaultSql) {
          sql += ` DEFAULT ${data.defaultSql}`;
        }
        if (data.autoIncrement) {
          sql += ` AUTO_INCREMENT`;
        }
        columnSql.push(sql);

        if (data.primary) {
          primaryColumns.push(column);
        }
        if (data.unique) {
          uniqueColumns.push(column);
        }
      }

      if (primaryColumns.length > 0) {
        columnSql.push(`PRIMARY KEY (${primaryColumns.join(', ')})`);
      }

      for (const uniqueColumn of uniqueColumns) {
        columnSql.push(`UNIQUE INDEX ${uniqueColumn}_UNIQUE (${uniqueColumn} ASC) VISIBLE`);
      }

      // TODO Foreign keys

      const sql = `CREATE TABLE ${table}
                   (
                       ${columnSql.join(', ')}
                   );`;
      scriptLines.push(sql);
    }

    for (const table of updateTables) {
      const dbTableSchema = schema[table]?.columns;
      const migrationTableSchema = migrationSchema[table]?.columns;

      const addColumnScript: string[] = [];
      let dropColumnScript: string[] = [];
      const modifyColumnScript: string[] = [];
      const addedUniqColumns: string[] = [];
      const deletedUniqColumns: string[] = []
      let redoPrimary = false;

      if (dbTableSchema === undefined || migrationTableSchema === undefined) {
        continue;
      }

      const columnsToAdd = Object.keys(migrationTableSchema)
        .filter(e => !Object.keys(dbTableSchema)
          .includes(e));
      const columnsToDelete = Object.keys(dbTableSchema)
        .filter(e => !Object.keys(migrationTableSchema)
          .includes(e));
      const columnsToCheck = Object.keys(migrationTableSchema)
        .filter(e => Object.keys(dbTableSchema)
          .includes(e));

      if (columnsToAdd.length > 0) {
        for (const column of columnsToAdd) {
          const data = migrationTableSchema[column];

          if (data === undefined) {
            continue;
          }

          let sql = "";
          sql += `${column} ${data.type}`;
          if (data.unsigned) {
            sql += ` UNSIGNED`;
          }
          sql += ` ${data.nullable ? 'NULL' : 'NOT NULL'}`;
          if (data.defaultSql) {
            sql += ` DEFAULT ${data.defaultSql}`;
          }
          if (data.autoIncrement) {
            sql += ` AUTO_INCREMENT`;
          }

          addColumnScript.push(`ADD COLUMN ${sql}`);

          if (data.primary) {
            redoPrimary = true;
          }

          if (data.unique) {
            addedUniqColumns.push(column);
          }
        }
      }

      if (columnsToDelete.length > 0) {
        for (const column of columnsToDelete) {
          dropColumnScript.push(`DROP COLUMN ${column}`);
          const dbData = dbTableSchema[column];
          if (dbData === undefined) {
            continue;
          }
          if (dbData.primary) {
            redoPrimary = true;
          }
          if (dbData.unique) {
            deletedUniqColumns.push(column);
          }
        }
      }

      if (columnsToCheck.length > 0) {
        for (const column of columnsToCheck) {
          let hasDifferences = false;

          const dbColumn = dbTableSchema[column];
          const migrationColumn = migrationTableSchema[column];

          if (dbColumn === undefined || migrationColumn === undefined) {
            continue;
          }

          if (dbColumn.type.toLowerCase()
            .replaceAll(" ", "") != migrationColumn.type.toLowerCase()
            .replaceAll(" ", "")) {
            hasDifferences = true;
          }
          if (dbColumn.autoIncrement != migrationColumn.autoIncrement) {
            hasDifferences = true;
          }
          if (dbColumn.nullable != migrationColumn.nullable) {
            hasDifferences = true;
          }
          if ((dbColumn.defaultSql ? (dbColumn.defaultSql ?? "").replace(/^\'/, "").replace(/\'$/, "") : dbColumn.defaultSql) != (migrationColumn.defaultSql ? (migrationColumn.defaultSql ?? "").replace(/^\'/, "").replace(/\'$/, "") : migrationColumn.defaultSql)) {
            hasDifferences = true;
          }
          if (dbColumn.unsigned != migrationColumn.unsigned) {
            hasDifferences = true;
          }
          if (dbColumn.primary != migrationColumn.primary) {
            redoPrimary = true;
          }

          if (dbColumn.unique != migrationColumn.unique) {
            if (migrationColumn.unique && !dbColumn.unique) {
              addedUniqColumns.push(column);
            } else if (!migrationColumn.unique && dbColumn.unique) {
              deletedUniqColumns.push(column);
            }
          }

          if (hasDifferences) {
            let sql = "";
            sql += `${column} ${migrationColumn.type}`;
            if (migrationColumn.unsigned) {
              sql += ` UNSIGNED`;
            }
            sql += ` ${migrationColumn.nullable ? 'NULL' : 'NOT NULL'}`;
            if (migrationColumn.defaultSql) {
              sql += ` DEFAULT ${migrationColumn.defaultSql}`;
            }
            if (migrationColumn.autoIncrement) {
              sql += ` AUTO_INCREMENT`;
            }

            modifyColumnScript.push(`MODIFY COLUMN ${sql}`);
          }
        }
      }

      let lines: string[] = [];
      if (addColumnScript.length > 0) {
        lines = lines.concat(addColumnScript);
      }
      if (dropColumnScript) {
        lines.concat(dropColumnScript);
      }
      if (modifyColumnScript.length > 0) {
        lines = lines.concat(modifyColumnScript);
      }
      if (redoPrimary) {
        const [indexes] = await connection.query(`SHOW INDEXES FROM ${table};`);
        const indexExists = !!(indexes as { Table: string; Non_unique: boolean; Key_name: string; Seq_in_index: boolean; Column_name: string; Null: string, Visible: "YES" | "NO" }[]).find(e => e.Key_name === "PRIMARY");
        if (indexExists) {
          lines.push("DROP PRIMARY KEY");
        }
        const primaryKeys = Object.keys(migrationTableSchema)
          .filter(column => migrationTableSchema[column]?.primary);
        if (primaryKeys.length > 0) {
          lines.push(`ADD PRIMARY KEY (${primaryKeys.join(", ")})`)
        }
      }
      if (deletedUniqColumns.length > 0) {
        for (const column of uniq(deletedUniqColumns)) {
          lines.push(`DROP INDEX ${column}_UNIQUE`);
        }
      }
      if (addedUniqColumns.length > 0) {
        for (const column of uniq(addedUniqColumns)) {
          lines.push(`ADD UNIQUE INDEX ${column}_UNIQUE (${column} ASC) VISIBLE`);
        }
      }
      if (lines.length > 0) {
        scriptLines.push(`ALTER TABLE ${table} ${lines.join(', ')};`);
      }
    }
    
    // Foreign key naming scheme => FK_ChildTable_childColumn_ParentTable_parentColumn
    // TODO Create
    /*
    ALTER TABLE `doffice`.`tbl_account_number` 
    ADD INDEX `FK_tbl_account_number_subscriber_id_tbl_subscriber_subscrib_idx` (`subscriber_id` ASC) VISIBLE;
    ;
    ALTER TABLE `doffice`.`tbl_account_number` 
    ADD CONSTRAINT `FK_tbl_account_number_subscriber_id_tbl_subscriber_subscriber_id`
      FOREIGN KEY (`subscriber_id`)
      REFERENCES `doffice`.`tbl_subscriber` (`subscriber_id`)
      ON DELETE NO ACTION
      ON UPDATE NO ACTION;
     */
    
    // TODO Delete 
    /*
    ALTER TABLE `doffice`.`tbl_account_number` 
    DROP FOREIGN KEY `FK_tbl_account_number_subscriber_id_tbl_subscriber_subscriber_id`;
    ALTER TABLE `doffice`.`tbl_account_number` 
    DROP INDEX `FK_tbl_account_number_subscriber_id_tbl_subscriber_subscrib_idx` ;
    ;
     */
    
    // TODO Modify
    // Drop first 
    // Add later

    scriptLines.push(`DROP TABLE IF EXISTS __myNodeORM;`)
    scriptLines.push(`CREATE TABLE __myNodeORM
                      (
                          version VARCHAR(36) NOT NULL,
                          DATE    DATETIME    NOT NULL DEFAULT NOW()
                      );`);
    scriptLines.push(`INSERT INTO __myNodeORM (version)
                      VALUES ('${latestMigrationVersion}');`);

    /* Save the script */
    const saveLocationPath = args.find((a) => a.includes('--output='))
      ?.replace('--output=', '') ?? "./";
    const saveLocation = path.join(process.cwd(), saveLocationPath, "integration-script.sql");
    fs.writeFileSync(saveLocation, scriptLines.join('\n'));
    console.log(`✅ Integration script saved at '${saveLocation}'`);

    return;
  }
  runIntegration()
    .then(() => {
      console.log("✅ Integration completed.");
      process.exit(1);
    });
} else {
  console.error("❌ No valid action found!");
  process.exit(1);
}