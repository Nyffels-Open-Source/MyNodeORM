import path from "node:path";
import fs from "node:fs";
import {mkdirSync} from "fs";
import {isEqual} from "lodash-es";
import {Schema} from "../models/schema.models.js";
import {
  getTable,
  getAllProperties,
  getAutoIncrement,
  getColumn,
  getDefaultSql,
  getNullable,
  getPrimary,
  getSqlType,
  getType,
  getUnique,
  getUnsigned, getForeignKey, ForeignKeyOption
} from "../decorators/index.js";
import {MigrationFileBuilder} from "../models/index.js";

export function createMigration(name: string, migrationLocationPath: string, classes: any[]) {
  if (!name) {
    console.error("❌ Name is required for a migration. Use '--name={{name}}' to declare a name of this migration.");
    process.exit(1);
  }

  const migrationLocation = path.join(process.cwd(), migrationLocationPath, "migrations");

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

  console.log("• Creating schema...");
  const schema: Schema = {};
  for (const dbClass of classes) {
    const table = getTable(dbClass);
    if (!table) {
      continue;
    }

    if (!schema[table]) {
      schema[table] = {
        columns: {}
      };
    }

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
        foreignKey: getForeignKey(dbClass, property),
      };
    }
  }

  fs.writeFileSync(path.join(migrationLocation, "schema.json"), JSON.stringify(schema));

  console.log("• Schema created.");

  if (version === 0) {
    console.log("• Creating migration file...");
      
    let migrationFileContent = MigrationFileBuilder.GetFileTemplate();
    const upQueries: string[] = [];
    const downQueries: string[] = [];

    for (const table of Object.keys(schema)) {
      downQueries.push(`DROP TABLE ${table}`);
      
      const tableSchema = schema[table]?.columns;
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

        columnSql.push(`INDEX \`fk_${key.table}_${key.column}_idx\` (\`${key.sourceColumn}\` ASC) VISIBLE`);
        columnSql.push(`CONSTRAINT \`fk_${key.table}_${key.column}\` FOREIGN KEY (\`${key.sourceColumn}\`) REFERENCES \`${key.table}\` (\`${key.column}\`) ON DELETE ${onDeleteAction} ON UPDATE ${onUpdateAction}`);
      }

      const sql = `CREATE TABLE ${table}(${columnSql.join(', ')});`;
      upQueries.push(sql);
    }
    
    migrationFileContent = migrationFileContent.replace("{{{{TEMPLATE-DATA-UP}}}}", upQueries.map(q => `this._builder.addQuery('${q}');`).join("\n"));
    migrationFileContent = migrationFileContent.replace("{{{{TEMPLATE-DATA-DOWN}}}}", downQueries.map(q => `this._builder.addQuery('${q}');`).join("\n"));

    mkdirSync(path.join(migrationLocation, migrationName), {recursive: true});
    fs.writeFileSync(path.join(migrationLocation, migrationName, "migration-plan.ts"), migrationFileContent);
    console.log("• Migration file created.");
  } else {
    // A schema exists!
    
    // console.log("• Creating migration file...");
    // let migrationFileContent = MigrationFileBuilder.GetFileTemplate();
    //
    // let downlogic = ''; // TODO Create up logic
    // let uplogic = ''; // TODO Create up logic
    //
    // if (isEqual(oldSchema, schema)) {
    //   const oldSchemaTables = Object.keys(oldSchema);
    //   const schemaTables = Object.keys(schema);
    //
    //   const addedTables = schemaTables.filter(t => oldSchemaTables.indexOf(t) < 0);
    //   const removedTables = oldSchemaTables.filter(t => schemaTables.indexOf(t) < 0);
    //   const existingTables = schemaTables.filter(t => !addedTables.concat(removedTables)
    //     .includes(t));
    //
    //   let isFirstEntry = true;
    //   let tIndex = 0;
    //
    //   (addedTables ?? []).forEach((table) => {
    //     if (!isFirstEntry) {
    //       uplogic += `\n\n        `;
    //       downlogic += `\n\n        `;
    //     } else {
    //       isFirstEntry = false;
    //     }
    //
    //     uplogic += `const table_${tIndex} = this._builder.addTable('${table}');\n`;
    //
    //     // @ts-ignore
    //     Object.keys(schema[table].columns)
    //       .forEach((column, cIndex) => {
    //         if (cIndex !== 0) {
    //           uplogic += `\n`
    //         }
    //         // @ts-ignore
    //         const sColumn = schema[table].columns[column];
    //         // @ts-ignore
    //         uplogic += `        table_${tIndex}.addColumn('${column}', '${sColumn.type}')`;
    //
    //         // @ts-ignore
    //         if (sColumn.primary) {
    //           uplogic += `.primary()`;
    //         }
    //         // @ts-ignore
    //         if (sColumn.nullable) {
    //           uplogic += `.nullable()`;
    //         }
    //         // @ts-ignore
    //         if (sColumn.unique) {
    //           uplogic += `.unique()`;
    //         }
    //         // @ts-ignore
    //         if (sColumn.unsigned) {
    //           uplogic += `.unsigned()`;
    //         }
    //         // @ts-ignore
    //         if (sColumn.autoIncrement) {
    //           uplogic += `.autoIncrement()`;
    //         }
    //         // @ts-ignore
    //         if ((sColumn.defaultSql ?? "").trim().length > 0) {
    //           // @ts-ignore
    //           uplogic += `.defaultSql('${sColumn.defaultSql.replaceAll('\'', '\\\'')}')`;
    //         }
    //         if (sColumn?.foreignKey !== null) {
    //           // @ts-ignore
    //           uplogic += `.foreignKey('${sColumn.foreignKey.table}', '${sColumn.foreignKey.column}', ${sColumn.foreignKey.onDelete}, ${sColumn.foreignKey.onUpdate})`;
    //         }
    //         uplogic += `;`;
    //       });
    //
    //     downlogic += `this._builder.dropTable('${table}')`;
    //
    //     tIndex += 1;
    //   });
    //
    //   (removedTables ?? []).forEach((table) => {
    //     if (!isFirstEntry) {
    //       uplogic += `\n\n        `;
    //       downlogic += `\n\n        `;
    //     } else {
    //       isFirstEntry = false;
    //     }
    //
    //     downlogic += `const table_${tIndex} = this._builder.addTable('${table}');\n`;
    //
    //     // @ts-ignore
    //     Object.keys(oldSchema[table].columns)
    //       .forEach((column, cIndex) => {
    //         if (cIndex !== 0) {
    //           downlogic += `\n`
    //         }
    //         // @ts-ignore
    //         const sColumn = oldSchema[table].columns[column];
    //         // @ts-ignore
    //         downlogic += `        table_${tIndex}.addColumn('${column}', '${sColumn.type}')`;
    //
    //         // @ts-ignore
    //         if (sColumn.primary) {
    //           downlogic += `.primary()`;
    //         }
    //         // @ts-ignore
    //         if (sColumn.nullable) {
    //           downlogic += `.nullable()`;
    //         }
    //         // @ts-ignore
    //         if (sColumn.unique) {
    //           downlogic += `.unique()`;
    //         }
    //         // @ts-ignore
    //         if (sColumn.unsigned) {
    //           downlogic += `.unsigned()`;
    //         }
    //         // @ts-ignore
    //         if (sColumn.autoIncrement) {
    //           downlogic += `.autoIncrement()`;
    //         }
    //         // @ts-ignore
    //         if ((sColumn.defaultSql ?? "").trim().length > 0) {
    //           // @ts-ignore
    //           downlogic += `.defaultSql('${sColumn.defaultSql.replaceAll('\'', '\\\'')}')`;
    //         }
    //         if (sColumn?.foreignKey !== null) {
    //           // @ts-ignore
    //           uplogic += `.foreignKey('${sColumn.foreignKey.table}', '${sColumn.foreignKey.column}', ${sColumn.foreignKey.onDelete}, ${sColumn.foreignKey.onUpdate})`;
    //         }
    //         downlogic += `;`;
    //       });
    //
    //     uplogic += `this._builder.dropTable('${table}')`;
    //
    //     tIndex += 1;
    //   });
    //
    //   if (uplogic.trim().length > 0) {
    //     uplogic += `\n\n        this._builder.execute();`;
    //   }
    //   if (downlogic.trim().length > 0) {
    //     downlogic += `\n\n        this._builder.execute();`;
    //   }
    // } else {
    //   console.log("⚠ Schema has no differences. Creating empty migration file...");
    // }
    //
    // migrationFileContent = migrationFileContent.replace("{{{{TEMPLATE-DATA-DOWN}}}}", downlogic);
    // migrationFileContent = migrationFileContent.replace("{{{{TEMPLATE-DATA-UP}}}}", uplogic);
    //
    // mkdirSync(path.join(migrationLocation, migrationName), {recursive: true});
    // fs.writeFileSync(path.join(migrationLocation, migrationName, "migration-plan.ts"), migrationFileContent);
    console.log("• Migration file created.");
  }

  console.log("✅  Migration completed.");
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