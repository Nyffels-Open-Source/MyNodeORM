#! /usr/bin/env node
import path from "node:path";
import * as fs from "node:fs";
import {DatabaseSchema} from "./models/schema.models.js";
import mysql, {RowDataPacket} from "mysql2/promise";
import {createRequire} from 'module';
import {difference, intersection, uniq} from "lodash-es";
import {ForeignKeyOption} from "./models/index.js";

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
let workdir = process.cwd();
if (args.some(e => /^--workdir=*./.test(e))) {
  workdir = args.find(a => a.includes("--workdir="))
    ?.replace("--workdir=", "") ?? "";
}
console.log(`• Working from ${workdir}.`);

if (args.includes("--generate-integration-script")) {
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
    const schema: DatabaseSchema = {};

    const [tablesRes] = await connection.query("SHOW TABLES;");
    const tables = (tablesRes as RowDataPacket[]).map(x => x[`Tables_in_${database}`]);
    for (const table of tables) {
      schema[table] = {columns: {}};

      const [columns] = await connection.query(`DESCRIBE ${table};`);
      const [indexes] = await connection.query(`SHOW INDEXES FROM ${table};`);
      const [keys] = await connection.query(`SELECT i.CONSTRAINT_NAME, i.TABLE_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME, r.UPDATE_RULE, r.DELETE_RULE, k.CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS i LEFT JOIN information_schema.KEY_COLUMN_USAGE k ON i.CONSTRAINT_NAME = k.CONSTRAINT_NAME LEFT JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON i.CONSTRAINT_NAME = r.CONSTRAINT_NAME WHERE i.CONSTRAINT_TYPE = 'FOREIGN KEY' AND i.TABLE_NAME = '${table}' AND i.TABLE_SCHEMA = DATABASE();`);
      for (const column of (columns as { Field: string; Type: string, Null: "YES" | "NO", Key: "PRI" | "UNI" | "MUL", Default: string, Extra: string }[])) {
        const index = (indexes as { Table: string; Non_unique: boolean; Key_name: string; Seq_in_index: boolean; Column_name: string; Null: string, Visible: "YES" | "NO" }[]).filter(e => e.Column_name == column.Field);
        const isUnique = !!index.find(e => !e.Non_unique && e.Key_name != "PRIMARY");
        const foreignKey = (keys as { CONSTRAINT_NAME: string, TABLE_NAME: string, COLUMN_NAME: string, REFERENCED_TABLE_NAME: string, REFERENCED_COLUMN_NAME: string, UPDATE_RULE: string, DELETE_RULE: string }[]).find(e => e.TABLE_NAME == table && e.COLUMN_NAME == column.Field) ?? null;

        schema[table].columns[column.Field] = {
          type: column.Type.replace(" unsigned", ""),
          primary: column.Key == "PRI",
          nullable: column.Null == "YES",
          unique: isUnique,
          unsigned: column.Type.includes("unsigned"),
          autoIncrement: column.Extra.includes("auto_increment"),
          defaultSql: column.Default,
          foreignKey: foreignKey ? {
            table: foreignKey.REFERENCED_TABLE_NAME,
            column: foreignKey.REFERENCED_COLUMN_NAME,
            onDelete: {"CASCADE": ForeignKeyOption.Cascade, "SET NULL": ForeignKeyOption.SetNull, "RESTRICT": ForeignKeyOption.Restrict}[foreignKey.DELETE_RULE] as ForeignKeyOption,
            onUpdate: {"CASCADE": ForeignKeyOption.Cascade, "SET NULL": ForeignKeyOption.SetNull, "RESTRICT": ForeignKeyOption.Restrict}[foreignKey.UPDATE_RULE] as ForeignKeyOption,
            name: foreignKey.CONSTRAINT_NAME
          } as any : null,
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
    
    const migrationSchema = JSON.parse(fs.readFileSync(path.join(migrationLocation, (latestMigrationVersion ?? ""), "schema.json"))
      .toString()) as DatabaseSchema;


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
      const foreignKeys: { table: string, column: string, sourceColumn: string, onDelete: ForeignKeyOption, onUpdate: ForeignKeyOption }[] = [];
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
        if (data.foreignKey) {
          foreignKeys.push({column: data.foreignKey.column, table: data.foreignKey.table, sourceColumn: column, onDelete: data.foreignKey.onDelete, onUpdate: data.foreignKey.onUpdate});
        }
      }

      if (primaryColumns.length > 0) {
        columnSql.push(`PRIMARY KEY (${primaryColumns.join(', ')})`);
      }

      for (const uniqueColumn of uniqueColumns) {
        columnSql.push(`UNIQUE INDEX ${uniqueColumn}_UNIQUE (${uniqueColumn} ASC) VISIBLE`);
      }

      for (const key of foreignKeys) {
        let onDeleteAction: 'CASCADE' | 'SET NULL' | 'RESTRICT' = "CASCADE";
        let onUpdateAction: 'CASCADE' | 'SET NULL' | 'RESTRICT' = "CASCADE";

        switch (key.onDelete) {
          case ForeignKeyOption.SetNull:
            onDeleteAction = "SET NULL";
            break;
          case ForeignKeyOption.Restrict:
            onDeleteAction = "RESTRICT";
            break;
          case ForeignKeyOption.Cascade:
            onDeleteAction = "CASCADE";
            break;
        }

        switch (key.onUpdate) {
          case ForeignKeyOption.SetNull:
            onUpdateAction = "SET NULL";
            break;
          case ForeignKeyOption.Restrict:
            onUpdateAction = "RESTRICT";
            break;
          case ForeignKeyOption.Cascade:
            onUpdateAction = "CASCADE";
            break;
        }

        const fName = `${table}_${key.sourceColumn}`.substring(0, 57);
        columnSql.push(`INDEX \`fk_${fName}_idx\` (\`${key.sourceColumn}\` ASC) VISIBLE`);
        columnSql.push(`CONSTRAINT \`fk_${fName}\` FOREIGN KEY (\`${key.sourceColumn}\`) REFERENCES \`${key.table}\` (\`${key.column}\`) ON DELETE ${onDeleteAction} ON UPDATE ${onUpdateAction}`);
      }

      const sql = `CREATE TABLE ${table}(${columnSql.join(', ')});`;
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
      const dropkeys: string[] = [];
      const addedKeys: { table: string, column: string, sourceColumn: string, onDelete: ForeignKeyOption, onUpdate: ForeignKeyOption }[] = [];

      if (dbTableSchema === undefined || migrationTableSchema === undefined) {
        continue;
      }

      const columnsToAdd = difference(Object.keys(migrationTableSchema), Object.keys(dbTableSchema));
      const columnsToDelete = difference(Object.keys(dbTableSchema), Object.keys(migrationTableSchema));
      const columnsToCheck = intersection(Object.keys(migrationTableSchema), Object.keys(dbTableSchema));

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
          
          if (data.foreignKey) {
            addedKeys.push({
              column: data.foreignKey.column,
              table: data.foreignKey.table,
              sourceColumn: column, 
              onDelete: data.foreignKey.onDelete, 
              onUpdate: data.foreignKey.onUpdate
            })
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
          if ((dbColumn.defaultSql ? (dbColumn.defaultSql ?? "").replace(/^\'/, "")
            .replace(/\'$/, "") : dbColumn.defaultSql) != (migrationColumn.defaultSql ? (migrationColumn.defaultSql ?? "").replace(/^\'/, "")
            .replace(/\'$/, "") : migrationColumn.defaultSql)) {
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
          
          if (dbColumn.foreignKey && (!migrationColumn.foreignKey || dbColumn.foreignKey.column != migrationColumn.foreignKey?.column || dbColumn.foreignKey.table != migrationColumn.foreignKey?.table || dbColumn.foreignKey.onUpdate != migrationColumn.foreignKey?.onUpdate || dbColumn.foreignKey.onDelete != migrationColumn.foreignKey?.onDelete)) {
            dropkeys.push((dbColumn.foreignKey as any)['name'])
          }

          if (migrationColumn.foreignKey !== null && (!dbColumn.foreignKey || dbColumn.foreignKey.column != migrationColumn.foreignKey?.column || dbColumn.foreignKey.table != migrationColumn.foreignKey?.table || dbColumn.foreignKey.onUpdate != migrationColumn.foreignKey?.onUpdate || dbColumn.foreignKey.onDelete != migrationColumn.foreignKey?.onDelete)) {
            addedKeys.push({
              column: migrationColumn.foreignKey.column,
              table: migrationColumn.foreignKey.table,
              sourceColumn: column, 
              onDelete: migrationColumn.foreignKey.onDelete, 
              onUpdate: migrationColumn.foreignKey.onUpdate,
            });
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
        lines = lines.concat(dropColumnScript);
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
      
      if (dropkeys.length > 0) {
        scriptLines.push(`ALTER TABLE \`${table}\` ${dropkeys.map(k => `DROP FOREIGN KEY \`${k}\``).join(", ")}, ${dropkeys.map(k => `DROP INDEX \`${k}_idx\``)};`);
      }
      
      if (addedKeys.length > 0) {
        for (const key of addedKeys) {
          let onDeleteAction: 'CASCADE' | 'SET NULL' | 'RESTRICT' = "CASCADE";
          let onUpdateAction: 'CASCADE' | 'SET NULL' | 'RESTRICT' = "CASCADE";

          switch (key.onDelete) {
            case ForeignKeyOption.SetNull:
              onDeleteAction = "SET NULL";
              break;
            case ForeignKeyOption.Restrict:
              onDeleteAction = "RESTRICT";
              break;
            case ForeignKeyOption.Cascade:
              onDeleteAction = "CASCADE";
              break;
          }

          switch (key.onUpdate) {
            case ForeignKeyOption.SetNull:
              onUpdateAction = "SET NULL";
              break;
            case ForeignKeyOption.Restrict:
              onUpdateAction = "RESTRICT";
              break;
            case ForeignKeyOption.Cascade:
              onUpdateAction = "CASCADE";
              break;
          }

          const fName = `${table}_${key.sourceColumn}`.substring(0, 57);
          lines.push(`ADD INDEX \`fk_${fName}_idx\` (\`${key.sourceColumn}\` ASC) VISIBLE`);
          lines.push(`ADD CONSTRAINT \`fk_${fName}\` FOREIGN KEY (\`${key.sourceColumn}\`) REFERENCES \`${key.table}\` (\`${key.column}\`) ON DELETE ${onDeleteAction} ON UPDATE ${onUpdateAction}`);
        }
      }
      
      if (lines.length > 0) {
        scriptLines.push(`ALTER TABLE ${table} ${lines.join(', ')};`);
      }
    }

    scriptLines.push(`DROP TABLE IF EXISTS __myNodeORM;`)
    scriptLines.push(`CREATE TABLE __myNodeORM (version INT NOT NULL, DATE DATETIME NOT NULL DEFAULT NOW());`);
    scriptLines.push(`INSERT INTO __myNodeORM (version) VALUES (${(latestMigrationVersion ?? "").split(".").find(x => x)});`);

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