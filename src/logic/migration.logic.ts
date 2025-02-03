import path from "node:path";
import fs from "node:fs";
import {mkdirSync} from "fs";
import {uniq} from "lodash-es";
import {DatabaseSchema} from "../models/schema.models.js";
import {ForeignKeyOption, MigrationFileBuilder} from "../models/index.js";

export function createMigration(name: string, migrationLocationPath: string, classes: any[]) {
  throw new Error("Currently disabled!");
  // TODO
  // if (!name) {
  //   console.error("❌ Name is required for a migration. Use '--name={{name}}' to declare a name of this migration.");
  //   process.exit(1);
  // }
  //
  // const migrationLocation = path.join(process.cwd(), migrationLocationPath, "migrations");
  //
  // if (!fs.existsSync(migrationLocation)) {
  //   console.log("• Migration location does not exists... Creating folder.");
  //   fs.mkdirSync(migrationLocation, {recursive: true});
  // }
  //
  // const folders = fs.readdirSync(migrationLocation, {withFileTypes: true})
  //   .filter(f => f.isDirectory())
  //   .map(f => f.name);
  //
  // let version = 0;
  // const migrationName = `${version}.${getDateFormat()}_${name}`;
  //
  // let oldSchema!: DatabaseSchema;
  // if ((folders).length > 0) {
  //   // @ts-ignore
  //   version = (folders.map(f => +f.split(".")[0])
  //     .sort()
  //     .reverse()[0]) + 1;
  //
  //   oldSchema = JSON.parse(fs.readFileSync(path.join(migrationLocation, (folders.sort()
  //     .reverse()
  //     .find(x => x) ?? ""), "schema.json"))
  //     .toString());
  // }
  //
  // console.log("• Creating schema...");
  // const schema: DatabaseSchema = {};
  // for (const dbClass of classes) {
  //   const table = getTable(dbClass);
  //   if (!table) {
  //     continue;
  //   }
  //
  //   if (!schema[table]) {
  //     schema[table] = {
  //       columns: {}
  //     };
  //   }
  //
  //   const properties = getAllProperties(dbClass);
  //   for (let property of properties) {
  //     const type = getType(dbClass, property);
  //
  //     schema[table].columns[getColumn(dbClass, property)] = {
  //       type: getSqlType(dbClass, property),
  //       primary: getPrimary(dbClass, property),
  //       nullable: getNullable(dbClass, property),
  //       unique: getUnique(dbClass, property),
  //       unsigned: ['number', 'bignumber'].includes(type) ? getUnsigned(dbClass, property) : false,
  //       autoIncrement: getAutoIncrement(dbClass, property),
  //       defaultSql: getDefaultSql(dbClass, property) ?? null,
  //       foreignKey: getForeignKey(dbClass, property),
  //     };
  //   }
  // }
  //
  // mkdirSync(path.join(migrationLocation, migrationName), {recursive: true});
  // fs.writeFileSync(path.join(migrationLocation, migrationName, "schema.json"), JSON.stringify(schema));
  //
  // console.log("• Schema created.");
  //
  // if (version === 0) {
  //   console.log("• Creating migration file...");
  //
  //   let migrationFileContent = MigrationFileBuilder.GetFileTemplate();
  //   const queryLines: string[] = [];
  //
  //   for (const table of Object.keys(schema)) {
  //     const tableSchema = schema[table]?.columns;
  //     if (tableSchema === undefined) {
  //       continue;
  //     }
  //
  //     const columnSql: string[] = [];
  //     const primaryColumns: string[] = [];
  //     const uniqueColumns: string[] = [];
  //     const foreignKeys: { table: string, column: string, sourceColumn: string, onDelete: ForeignKeyOption, onUpdate: ForeignKeyOption }[] = [];
  //     for (const column of Object.keys(tableSchema)) {
  //       const data = tableSchema[column];
  //       if (data == null) {
  //         continue;
  //       }
  //
  //       let sql = "";
  //       sql += `${column} ${data.type}`;
  //       if (data.unsigned) {
  //         sql += ` UNSIGNED`;
  //       }
  //       sql += ` ${data.nullable ? 'NULL' : 'NOT NULL'}`;
  //       if (data.defaultSql) {
  //         sql += ` DEFAULT ${data.defaultSql}`;
  //       }
  //       if (data.autoIncrement) {
  //         sql += ` AUTO_INCREMENT`;
  //       }
  //       columnSql.push(sql);
  //
  //       if (data.primary) {
  //         primaryColumns.push(column);
  //       }
  //       if (data.unique) {
  //         uniqueColumns.push(column);
  //       }
  //       if (data.foreignKey) {
  //         foreignKeys.push({column: data.foreignKey.column, table: data.foreignKey.table, sourceColumn: column, onDelete: data.foreignKey.onDelete, onUpdate: data.foreignKey.onUpdate});
  //       }
  //     }
  //
  //     if (primaryColumns.length > 0) {
  //       columnSql.push(`PRIMARY KEY (${primaryColumns.join(', ')})`);
  //     }
  //
  //     for (const uniqueColumn of uniqueColumns) {
  //       columnSql.push(`UNIQUE INDEX ${uniqueColumn}_UNIQUE (${uniqueColumn} ASC) VISIBLE`);
  //     }
  //
  //     for (const key of foreignKeys) {
  //       let onDeleteAction: 'CASCADE' | 'SET NULL' | 'RESTRICT' = "CASCADE";
  //       let onUpdateAction: 'CASCADE' | 'SET NULL' | 'RESTRICT' = "CASCADE";
  //
  //       switch (key.onDelete) {
  //         case ForeignKeyOption.SetNull:
  //           onDeleteAction = "SET NULL";
  //           break;
  //         case ForeignKeyOption.Restrict:
  //           onDeleteAction = "RESTRICT";
  //           break;
  //         case ForeignKeyOption.Cascade:
  //           onDeleteAction = "CASCADE";
  //           break;
  //       }
  //
  //       switch (key.onUpdate) {
  //         case ForeignKeyOption.SetNull:
  //           onUpdateAction = "SET NULL";
  //           break;
  //         case ForeignKeyOption.Restrict:
  //           onUpdateAction = "RESTRICT";
  //           break;
  //         case ForeignKeyOption.Cascade:
  //           onUpdateAction = "CASCADE";
  //           break;
  //       }
  //
  //       columnSql.push(`INDEX \`fk_${key.table}_${key.column}_idx\` (\`${key.sourceColumn}\` ASC) VISIBLE`);
  //       columnSql.push(`CONSTRAINT \`fk_${key.table}_${key.column}\` FOREIGN KEY (\`${key.sourceColumn}\`) REFERENCES \`${key.table}\` (\`${key.column}\`) ON DELETE ${onDeleteAction} ON UPDATE ${onUpdateAction}`);
  //     }
  //
  //     const sql = `CREATE TABLE ${table}
  //                  (
  //                      ${columnSql.join(', ')}
  //                  );`;
  //     queryLines.push(sql);
  //   }
  //
  //   migrationFileContent = migrationFileContent.replace("{{{{TEMPLATE-DATA}}}}", queryLines.map(q => `        this._builder.addQuery('${q.replaceAll("'", "\\'")}');`)
  //     .join("\n"));
  //   migrationFileContent = migrationFileContent.replace("{{{{VERSION}}}}", version.toString());
  //
  //   mkdirSync(path.join(migrationLocation, migrationName), {recursive: true});
  //   fs.writeFileSync(path.join(migrationLocation, migrationName, "migration-plan.ts"), migrationFileContent);
  //   console.log("• Migration file created.");
  // } else {
  //   console.log("• Creating migration file...");
  //   let migrationFileContent = MigrationFileBuilder.GetFileTemplate();
  //   const queryLines: string[] = [];
  //
  //   const newTables = Object.keys(schema);
  //   const oldTables = Object.keys(oldSchema);
  //
  //   const droptables = oldTables.filter(e => !newTables.includes(e));
  //   const addtables = newTables.filter(e => !oldTables.includes(e));
  //   const updateTables = oldTables.filter(e => newTables.includes(e));
  //
  //   for (const table of droptables) {
  //     queryLines.push(`DROP TABLE ${table};`);
  //   }
  //
  //   for (const table of addtables) {
  //     const tableSchema = schema[table]?.columns;
  //     if (tableSchema === undefined) {
  //       continue;
  //     }
  //
  //     const columnSql: string[] = [];
  //     const primaryColumns: string[] = [];
  //     const uniqueColumns: string[] = [];
  //     const foreignKeys: { table: string, column: string, sourceColumn: string, onDelete: ForeignKeyOption, onUpdate: ForeignKeyOption }[] = [];
  //     for (const column of Object.keys(tableSchema)) {
  //       const data = tableSchema[column];
  //       if (data == null) {
  //         continue;
  //       }
  //
  //       let sql = "";
  //       sql += `${column} ${data.type}`;
  //       if (data.unsigned) {
  //         sql += ` UNSIGNED`;
  //       }
  //       sql += ` ${data.nullable ? 'NULL' : 'NOT NULL'}`;
  //       if (data.defaultSql) {
  //         sql += ` DEFAULT ${data.defaultSql}`;
  //       }
  //       if (data.autoIncrement) {
  //         sql += ` AUTO_INCREMENT`;
  //       }
  //       columnSql.push(sql);
  //
  //       if (data.primary) {
  //         primaryColumns.push(column);
  //       }
  //       if (data.unique) {
  //         uniqueColumns.push(column);
  //       }
  //       if (data.foreignKey) {
  //         foreignKeys.push({column: data.foreignKey.column, table: data.foreignKey.table, sourceColumn: column, onDelete: data.foreignKey.onDelete, onUpdate: data.foreignKey.onUpdate});
  //       }
  //     }
  //
  //     if (primaryColumns.length > 0) {
  //       columnSql.push(`PRIMARY KEY (${primaryColumns.join(', ')})`);
  //     }
  //
  //     for (const uniqueColumn of uniqueColumns) {
  //       columnSql.push(`UNIQUE INDEX ${uniqueColumn}_UNIQUE (${uniqueColumn} ASC) VISIBLE`);
  //     }
  //
  //     for (const key of foreignKeys) {
  //       let onDeleteAction: 'CASCADE' | 'SET NULL' | 'RESTRICT' = "CASCADE";
  //       let onUpdateAction: 'CASCADE' | 'SET NULL' | 'RESTRICT' = "CASCADE";
  //
  //       switch (key.onDelete) {
  //         case ForeignKeyOption.SetNull:
  //           onDeleteAction = "SET NULL";
  //           break;
  //         case ForeignKeyOption.Restrict:
  //           onDeleteAction = "RESTRICT";
  //           break;
  //         case ForeignKeyOption.Cascade:
  //           onDeleteAction = "CASCADE";
  //           break;
  //       }
  //
  //       switch (key.onUpdate) {
  //         case ForeignKeyOption.SetNull:
  //           onUpdateAction = "SET NULL";
  //           break;
  //         case ForeignKeyOption.Restrict:
  //           onUpdateAction = "RESTRICT";
  //           break;
  //         case ForeignKeyOption.Cascade:
  //           onUpdateAction = "CASCADE";
  //           break;
  //       }
  //
  //       columnSql.push(`INDEX \`fk_${key.table}_${key.column}_idx\` (\`${key.sourceColumn}\` ASC) VISIBLE`);
  //       columnSql.push(`CONSTRAINT \`fk_${key.table}_${key.column}\` FOREIGN KEY (\`${key.sourceColumn}\`) REFERENCES \`${key.table}\` (\`${key.column}\`) ON DELETE ${onDeleteAction} ON UPDATE ${onUpdateAction}`);
  //     }
  //
  //     const sql = `CREATE TABLE ${table}
  //                  (
  //                      ${columnSql.join(', ')}
  //                  );`;
  //     queryLines.push(sql);
  //   }
  //
  //   for (const table of updateTables) {
  //     const dbTableSchema = schema[table]?.columns;
  //     const oldTableSchema = oldSchema[table]?.columns;
  //
  //     const addColumnScript: string[] = [];
  //     let dropColumnScript: string[] = [];
  //     const modifyColumnScript: string[] = [];
  //     const addedUniqColumns: string[] = [];
  //     const deletedUniqColumns: string[] = []
  //     let redoPrimary = false;
  //     const dropkeys: string[] = [];
  //     const addedKeys: { table: string, column: string, sourceColumn: string, onDelete: ForeignKeyOption, onUpdate: ForeignKeyOption }[] = [];
  //
  //     if (dbTableSchema === undefined || oldTableSchema === undefined) {
  //       continue;
  //     }
  //
  //     const columnsToAdd = Object.keys(oldTableSchema)
  //       .filter(e => !Object.keys(dbTableSchema)
  //         .includes(e));
  //     const columnsToDelete = Object.keys(dbTableSchema)
  //       .filter(e => !Object.keys(oldTableSchema)
  //         .includes(e));
  //     const columnsToCheck = Object.keys(oldTableSchema)
  //       .filter(e => Object.keys(dbTableSchema)
  //         .includes(e));
  //
  //     if (columnsToAdd.length > 0) {
  //       for (const column of columnsToAdd) {
  //         const data = oldTableSchema[column];
  //
  //         if (data === undefined) {
  //           continue;
  //         }
  //
  //         let sql = "";
  //         sql += `${column} ${data.type}`;
  //         if (data.unsigned) {
  //           sql += ` UNSIGNED`;
  //         }
  //         sql += ` ${data.nullable ? 'NULL' : 'NOT NULL'}`;
  //         if (data.defaultSql) {
  //           sql += ` DEFAULT ${data.defaultSql}`;
  //         }
  //         if (data.autoIncrement) {
  //           sql += ` AUTO_INCREMENT`;
  //         }
  //
  //         addColumnScript.push(`ADD COLUMN ${sql}`);
  //
  //         if (data.primary) {
  //           redoPrimary = true;
  //         }
  //
  //         if (data.unique) {
  //           addedUniqColumns.push(column);
  //         }
  //
  //         if (data.foreignKey) {
  //           addedKeys.push({
  //             column: data.foreignKey.column,
  //             table: data.foreignKey.table,
  //             sourceColumn: column,
  //             onDelete: data.foreignKey.onDelete,
  //             onUpdate: data.foreignKey.onUpdate
  //           })
  //         }
  //       }
  //     }
  //
  //     if (columnsToDelete.length > 0) {
  //       for (const column of columnsToDelete) {
  //         dropColumnScript.push(`DROP COLUMN ${column}`);
  //         const dbData = dbTableSchema[column];
  //         if (dbData === undefined) {
  //           continue;
  //         }
  //         if (dbData.primary) {
  //           redoPrimary = true;
  //         }
  //         if (dbData.unique) {
  //           deletedUniqColumns.push(column);
  //         }
  //       }
  //     }
  //
  //     if (columnsToCheck.length > 0) {
  //       for (const column of columnsToCheck) {
  //         let hasDifferences = false;
  //
  //         const dbColumn = dbTableSchema[column];
  //         const migrationColumn = oldTableSchema[column];
  //
  //         if (dbColumn === undefined || migrationColumn === undefined) {
  //           continue;
  //         }
  //
  //         if (dbColumn.type.toLowerCase()
  //           .replaceAll(" ", "") != migrationColumn.type.toLowerCase()
  //           .replaceAll(" ", "")) {
  //           hasDifferences = true;
  //         }
  //         if (dbColumn.autoIncrement != migrationColumn.autoIncrement) {
  //           hasDifferences = true;
  //         }
  //         if (dbColumn.nullable != migrationColumn.nullable) {
  //           hasDifferences = true;
  //         }
  //         if ((dbColumn.defaultSql ? (dbColumn.defaultSql ?? "").replace(/^\'/, "")
  //           .replace(/\'$/, "") : dbColumn.defaultSql) != (migrationColumn.defaultSql ? (migrationColumn.defaultSql ?? "").replace(/^\'/, "")
  //           .replace(/\'$/, "") : migrationColumn.defaultSql)) {
  //           hasDifferences = true;
  //         }
  //         if (dbColumn.unsigned != migrationColumn.unsigned) {
  //           hasDifferences = true;
  //         }
  //         if (dbColumn.primary != migrationColumn.primary) {
  //           redoPrimary = true;
  //         }
  //
  //         if (dbColumn.unique != migrationColumn.unique) {
  //           if (migrationColumn.unique && !dbColumn.unique) {
  //             addedUniqColumns.push(column);
  //           } else if (!migrationColumn.unique && dbColumn.unique) {
  //             deletedUniqColumns.push(column);
  //           }
  //         }
  //
  //         if (dbColumn.foreignKey && (!migrationColumn.foreignKey || dbColumn.foreignKey.column != migrationColumn.foreignKey?.column || dbColumn.foreignKey.table != migrationColumn.foreignKey?.table || dbColumn.foreignKey.onUpdate != migrationColumn.foreignKey?.onUpdate || dbColumn.foreignKey.onDelete != migrationColumn.foreignKey?.onDelete)) {
  //           dropkeys.push((dbColumn.foreignKey as any)['name'])
  //         }
  //
  //         if (migrationColumn.foreignKey !== null && (!dbColumn.foreignKey || dbColumn.foreignKey.column != migrationColumn.foreignKey?.column || dbColumn.foreignKey.table != migrationColumn.foreignKey?.table || dbColumn.foreignKey.onUpdate != migrationColumn.foreignKey?.onUpdate || dbColumn.foreignKey.onDelete != migrationColumn.foreignKey?.onDelete)) {
  //           addedKeys.push({
  //             column: migrationColumn.foreignKey.column,
  //             table: migrationColumn.foreignKey.table,
  //             sourceColumn: column,
  //             onDelete: migrationColumn.foreignKey.onDelete,
  //             onUpdate: migrationColumn.foreignKey.onUpdate,
  //           });
  //         }
  //
  //         if (hasDifferences) {
  //           let sql = "";
  //           sql += `${column} ${migrationColumn.type}`;
  //           if (migrationColumn.unsigned) {
  //             sql += ` UNSIGNED`;
  //           }
  //           sql += ` ${migrationColumn.nullable ? 'NULL' : 'NOT NULL'}`;
  //           if (migrationColumn.defaultSql) {
  //             sql += ` DEFAULT ${migrationColumn.defaultSql}`;
  //           }
  //           if (migrationColumn.autoIncrement) {
  //             sql += ` AUTO_INCREMENT`;
  //           }
  //
  //           modifyColumnScript.push(`MODIFY COLUMN ${sql}`);
  //         }
  //       }
  //     }
  //
  //     let lines: string[] = [];
  //     if (addColumnScript.length > 0) {
  //       lines = lines.concat(addColumnScript);
  //     }
  //     if (dropColumnScript) {
  //       lines.concat(dropColumnScript);
  //     }
  //     if (modifyColumnScript.length > 0) {
  //       lines = lines.concat(modifyColumnScript);
  //     }
  //     if (redoPrimary) {
  //       let indexExists = false;
  //       // @ts-ignore
  //       for (const column of Object.keys(oldSchema[table].columns)) {
  //         // @ts-ignore
  //         if (oldSchema[table].columns[column].primary) {
  //           indexExists = true;
  //           break;
  //         }
  //       }
  //
  //       if (indexExists) {
  //         lines.push("DROP PRIMARY KEY");
  //       }
  //       const primaryKeys = Object.keys(oldTableSchema)
  //         .filter(column => oldTableSchema[column]?.primary);
  //       if (primaryKeys.length > 0) {
  //         lines.push(`ADD PRIMARY KEY (${primaryKeys.join(", ")})`)
  //       }
  //     }
  //     if (deletedUniqColumns.length > 0) {
  //       for (const column of uniq(deletedUniqColumns)) {
  //         lines.push(`DROP INDEX ${column}_UNIQUE`);
  //       }
  //     }
  //     if (addedUniqColumns.length > 0) {
  //       for (const column of uniq(addedUniqColumns)) {
  //         lines.push(`ADD UNIQUE INDEX ${column}_UNIQUE (${column} ASC) VISIBLE`);
  //       }
  //     }
  //
  //     if (dropkeys.length > 0) {
  //       queryLines.push(`ALTER TABLE \`${table}\` ${dropkeys.map(k => `DROP FOREIGN KEY \`${k}\``)
  //               .join(", ")}, ${dropkeys.map(k => `DROP INDEX \`${k}_idx\``)}`);
  //     }
  //
  //     if (addedKeys.length > 0) {
  //       for (const key of addedKeys) {
  //         let onDeleteAction: 'CASCADE' | 'SET NULL' | 'RESTRICT' = "CASCADE";
  //         let onUpdateAction: 'CASCADE' | 'SET NULL' | 'RESTRICT' = "CASCADE";
  //
  //         switch (key.onDelete) {
  //           case ForeignKeyOption.SetNull:
  //             onDeleteAction = "SET NULL";
  //             break;
  //           case ForeignKeyOption.Restrict:
  //             onDeleteAction = "RESTRICT";
  //             break;
  //           case ForeignKeyOption.Cascade:
  //             onDeleteAction = "CASCADE";
  //             break;
  //         }
  //
  //         switch (key.onUpdate) {
  //           case ForeignKeyOption.SetNull:
  //             onUpdateAction = "SET NULL";
  //             break;
  //           case ForeignKeyOption.Restrict:
  //             onUpdateAction = "RESTRICT";
  //             break;
  //           case ForeignKeyOption.Cascade:
  //             onUpdateAction = "CASCADE";
  //             break;
  //         }
  //
  //         lines.push(`ADD INDEX \`fk_${key.table}_${key.column}_idx\` (\`${key.sourceColumn}\` ASC) VISIBLE`);
  //         lines.push(`ADD CONSTRAINT \`fk_${key.table}_${key.column}\` FOREIGN KEY (\`${key.sourceColumn}\`) REFERENCES \`${key.table}\` (\`${key.column}\`) ON DELETE ${onDeleteAction} ON UPDATE ${onUpdateAction}`);
  //       }
  //     }
  //
  //     if (lines.length > 0) {
  //       queryLines.push(`ALTER TABLE ${table} ${lines.join(', ')};`);
  //     }
  //   }
  //
  //   migrationFileContent = migrationFileContent.replace("{{{{TEMPLATE-DATA}}}}", queryLines.map(q => `        this._builder.addQuery('${q.replaceAll("'", "\\'")}');`)
  //     .join("\n"));
  //   migrationFileContent = migrationFileContent.replace("{{{{VERSION}}}}", version.toString());
  //
  //   mkdirSync(path.join(migrationLocation, migrationName), {recursive: true});
  //   fs.writeFileSync(path.join(migrationLocation, migrationName, "migration-plan.ts"), migrationFileContent);
  //   console.log("• Migration file created.");
  // }
  //
  // console.log("✅  Migration completed.");
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