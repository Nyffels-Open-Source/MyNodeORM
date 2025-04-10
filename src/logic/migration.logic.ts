import path from "node:path";
import fs from "node:fs";
import {mkdirSync} from "fs";
import {difference, intersection, sortBy, uniq} from "lodash-es";
import {DatabaseSchema} from "../models/schema.models.js";
import {DeclarationStorage, ForeignKeyOption, MigrationFileBuilder} from "../models/index.js";
import {doQuery, setConnection} from "./mysql.logic.js";

/**
 * Create a new migration.
 * @param name Give the migration a name.
 * @param migrationLocationPath The location where the migration folder resides.
 */
export function createMigration(name: string, migrationLocationPath: string) {
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

    let version = getDateFormat();
    let isFirst = false;
    console.log("• Retrieving old schema...");
    let oldSchema!: DatabaseSchema;
    if ((folders).length > 0) {
        oldSchema = JSON.parse(fs.readFileSync(path.join(migrationLocation, (folders.sort()
            .reverse()
            .find(x => x) ?? ""), "schema.json"))
            .toString());
    } else {
        isFirst = true;
    }

    const migrationName = `${getDateFormat()}_${name}`;

    console.log("• Retrieving current schema...");
    const currentSchema = DeclarationStorage.get()
        .declaration
        .convertToDatabaseSchema();

    mkdirSync(path.join(migrationLocation, migrationName), {recursive: true});
    fs.writeFileSync(path.join(migrationLocation, migrationName, "schema.json"), JSON.stringify(currentSchema));

    console.log("• Schema retrieved and saved.");

    if (isFirst) {
        console.log("• Creating migration file...");

        let migrationFileContent = MigrationFileBuilder.GetFileTemplate();
        const queryLines: string[] = [];

        for (const table of Object.keys(currentSchema)) {
            const tableSchema = currentSchema[table]?.columns;
            if (tableSchema === undefined) {
                continue;
            }

            const columnSql: string[] = [];
            const primaryColumns: string[] = [];
            const uniqueColumns: string[] = [];
            const foreignKeys: {
                table: string,
                column: string,
                sourceColumn: string,
                onDelete: ForeignKeyOption,
                onUpdate: ForeignKeyOption
            }[] = [];
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
                    foreignKeys.push({
                        column: data.foreignKey.column,
                        table: data.foreignKey.table,
                        sourceColumn: column,
                        onDelete: data.foreignKey.onDelete,
                        onUpdate: data.foreignKey.onUpdate
                    });
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

      const sql = `CREATE TABLE ${table} (${columnSql.join(', ')});`;
      queryLines.push(sql);
    }

        migrationFileContent = migrationFileContent.replace("{{{{TEMPLATE-DATA}}}}", queryLines.map(q => `        this._builder.addQuery('${q.replaceAll("'", "\\'")}');`)
            .join("\n"));
        migrationFileContent = migrationFileContent.replace("{{{{VERSION}}}}", version.toString());

        mkdirSync(path.join(migrationLocation, migrationName), {recursive: true});
        fs.writeFileSync(path.join(migrationLocation, migrationName, "migration-plan.ts"), migrationFileContent);
        console.log("• Migration file created.");
    } else {
        console.log("• Creating migration file...");
        let migrationFileContent = MigrationFileBuilder.GetFileTemplate();
        const queryLines: string[] = [];

        const newTables = Object.keys(currentSchema);
        const oldTables = Object.keys(oldSchema);

        const droptables = oldTables.filter(e => !newTables.includes(e));
        const addtables = newTables.filter(e => !oldTables.includes(e));
        const updateTables = oldTables.filter(e => newTables.includes(e));

        for (const table of droptables) {
            queryLines.push(`DROP TABLE ${table};`);
        }

        for (const table of addtables) {
            const tableSchema = currentSchema[table]?.columns;
            if (tableSchema === undefined) {
                continue;
            }

            const columnSql: string[] = [];
            const primaryColumns: string[] = [];
            const uniqueColumns: string[] = [];
            const foreignKeys: {
                table: string,
                column: string,
                sourceColumn: string,
                onDelete: ForeignKeyOption,
                onUpdate: ForeignKeyOption
            }[] = [];
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
                    foreignKeys.push({
                        column: data.foreignKey.column,
                        table: data.foreignKey.table,
                        sourceColumn: column,
                        onDelete: data.foreignKey.onDelete,
                        onUpdate: data.foreignKey.onUpdate
                    });
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

      const sql = `CREATE TABLE ${table} (${columnSql.join(', ')});`;
      queryLines.push(sql);
    }

        for (const table of updateTables) {
            const dbTableSchema = currentSchema[table]?.columns;
            const oldTableSchema = oldSchema[table]?.columns;

            const addColumnScript: string[] = [];
            let dropColumnScript: string[] = [];
            const modifyColumnScript: string[] = [];
            const addedUniqColumns: string[] = [];
            const deletedUniqColumns: string[] = []
            let redoPrimary = false;
            const dropkeys: string[] = [];
            const addedKeys: {
                table: string,
                column: string,
                sourceColumn: string,
                onDelete: ForeignKeyOption,
                onUpdate: ForeignKeyOption
            }[] = [];

            if (dbTableSchema === undefined || oldTableSchema === undefined) {
                continue;
            }

            const columnsToAdd = difference(Object.keys(dbTableSchema), Object.keys(oldTableSchema));
            const columnsToDelete = difference(Object.keys(oldTableSchema), Object.keys(dbTableSchema));
            const columnsToCheck = intersection(Object.keys(oldTableSchema), Object.keys(dbTableSchema));

            if (columnsToAdd.length > 0) {
                for (const column of columnsToAdd) {
                    const data = dbTableSchema[column];

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
                    const migrationColumn = oldTableSchema[column];

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

          if (dbColumn.foreignKey && (!migrationColumn.foreignKey || dbColumn.foreignKey.column != migrationColumn.foreignKey?.column || dbColumn.foreignKey.table != migrationColumn.foreignKey?.table || dbColumn.foreignKey.onUpdate != migrationColumn.foreignKey?.onUpdate ||
            dbColumn.foreignKey.onDelete != migrationColumn.foreignKey?.onDelete)) { dropkeys.push((dbColumn.foreignKey as any)['name']) }
          if (migrationColumn.foreignKey !== null && (!dbColumn.foreignKey || dbColumn.foreignKey.column != migrationColumn.foreignKey?.column || dbColumn.foreignKey.table !=
            migrationColumn.foreignKey?.table || dbColumn.foreignKey.onUpdate != migrationColumn.foreignKey?.onUpdate || dbColumn.foreignKey.onDelete != migrationColumn.foreignKey?.onDelete)) {
            addedKeys.push({
              column: migrationColumn.foreignKey.column, table: migrationColumn.foreignKey.table,
              sourceColumn: column, onDelete: migrationColumn.foreignKey.onDelete, onUpdate: migrationColumn.foreignKey.onUpdate,
            });
          }
          if (hasDifferences) {
            let sql = "";
            sql += `${column} ${dbColumn.type}`;
            if (dbColumn.unsigned) { 
                sql += ` UNSIGNED`; 
            }
            sql += ` ${dbColumn.nullable ? 'NULL' : 'NOT NULL'}`;
            if (dbColumn.defaultSql) { 
                sql += ` DEFAULT ${dbColumn.defaultSql}`; 
            }
            if (dbColumn.autoIncrement) { 
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
        let indexExists = false; // @ts-ignore 
        for (const column of Object.keys(oldSchema[table].columns)) { // @ts-ignore 
          if (oldSchema[table].columns[column].primary) {
            indexExists = true;
            break;
          }
        }
        if (indexExists) { lines.push("DROP PRIMARY KEY"); }
        const primaryKeys = Object.keys(oldTableSchema)
          .filter(column => oldTableSchema[column]?.primary);
        if
        (primaryKeys.length > 0) { lines.push(`ADD PRIMARY KEY (${primaryKeys.join(", ")})`) }
      }
      if (deletedUniqColumns.length > 0) { for (const column of uniq(deletedUniqColumns)) { lines.push(`DROP INDEX ${column}_UNIQUE`); } }
      if (addedUniqColumns.length > 0) {
        for (const column of
          uniq(addedUniqColumns)) { lines.push(`ADD UNIQUE INDEX ${column}_UNIQUE (${column} ASC) VISIBLE`); }
      }
      if (dropkeys.length > 0) {
        queryLines.push(`ALTER TABLE \`${table}\` ${dropkeys.map(k => `DROP FOREIGN KEY \`${k}\``)
                .join(", ")}, ${dropkeys.map(k => `DROP INDEX \`${k}_idx\``)}`);
      }
      if
      (addedKeys.length > 0) {
        for (const key of addedKeys) {
          let onDeleteAction: 'CASCADE' | 'SET NULL' | 'RESTRICT' = "CASCADE";
          let onUpdateAction: 'CASCADE' | 'SET NULL' | 'RESTRICT' = "CASCADE";
          switch (key.onDelete) {
            case ForeignKeyOption.SetNull:
              onDeleteAction = "SET NULL";
              break;
            case
            ForeignKeyOption.Restrict:
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
      if (lines.length > 0) { queryLines.push(`ALTER TABLE ${table} ${lines.join(', ')};`); }
    }
    migrationFileContent = migrationFileContent.replace("{{{{TEMPLATE-DATA}}}}", queryLines.map(q => `        this._builder.addQuery('${q.replaceAll("'", "\\'")}');`).join("\n"));
    migrationFileContent = migrationFileContent.replace("{{{{VERSION}}}}", version.toString());
    mkdirSync(path.join(migrationLocation, migrationName), {recursive: true});
    fs.writeFileSync(path.join(migrationLocation, migrationName, "migration-plan.ts"), migrationFileContent);
    console.log("• Migration file created.");
  }
  console.log("✅  Migration completed.");
}

/**
 * Update a database by the available migrations.
 * @param migrationLocationPath The location where the migration folder resides.
 * @param version What version do you want to limit the update to. Leave empty or null to go to the latest available version.
 */
export async function updateDatabase(migrationLocationPath: string, version: string | null = null) {
    const migrationLocation = path.join(process.cwd(), migrationLocationPath, "migrations");
    console.log("• Update database requested.");

    if (!fs.existsSync(migrationLocation)) {
        throw new Error("❌ Migration location does not exists. Can not execute migration!");
    }

    const folders = fs.readdirSync(migrationLocation, {withFileTypes: true})
        .filter(f => f.isDirectory())
        .map(f => f.name);

    let versions: { version: string, name: string }[] = [];
    for (const folder of folders) {
        const v = folder.split("_").find(x => x);
        if (v === undefined) {
            continue;
        }
        
        versions.push({
            version: v ?? '',
            name: folder
        });
    }

    if (versions.length <= 0) {
        throw new Error("❌ No viable versions found inside the migrations folder!");
    }

    versions = sortBy(versions, version => version.version);
    if (version !== null && !versions.find(v => v.version == version)) {
        throw new Error("❌ Requested version doesn't exist.");
    }
    
    await setConnection(); 
    const ivs = await doQuery<{version: string, DATE: Date}>('SELECT * FROM __myNodeORM');
    
    const unappliedVersions = getArrayDifference(versions.map(v => v.version), (ivs ?? []).map(v => v.version));

    for (const v of versions) {
        if (!unappliedVersions.includes(v.version)) {
            continue;
        }
        
        console.log("• migrate to version " + v.version + ".");
        let migrationPlanPath = path.join(migrationLocation, v.name, "migration-plan.js");
        if (!fs.existsSync(migrationPlanPath)) {
            migrationPlanPath = path.join(migrationLocation, v.name, "migration-plan.ts");
        }
        if (!fs.existsSync(migrationPlanPath)) {
            throw new Error("Could not find migration plan " + migrationPlanPath);
        }

        const Plan = await import('file://' + migrationPlanPath);
        const plan = new Plan.MigrationFile();
        try {
            await plan.migrate();   
        } catch (e: any) {
            console.log("❌ Error while migrating: " + e?.toString());
            process.exit(1);
        }
    }

    console.log(`✅  Database is up-to-date!`);
}

function getDateFormat(): string {
    const date = new Date();
    const year = date.getFullYear().toString().padStart(4, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function stringToDate(dateString: string): Date | null {
    if (dateString.length !== 14) {
        return null; // Ongeldig formaat
    }

    const year = parseInt(dateString.substring(0, 4), 10);
    const month = parseInt(dateString.substring(4, 6), 10) - 1;
    const day = parseInt(dateString.substring(6, 8), 10);
    const hours = parseInt(dateString.substring(8, 10), 10);
    const minutes = parseInt(dateString.substring(10, 12), 10);
    const seconds = parseInt(dateString.substring(12, 14), 10);

    const date = new Date(year, month, day, hours, minutes, seconds);
    
    if (isNaN(date.getTime())) {
        return null;
    }

    return date;
}

function getArrayDifference<T = any>(arrayA: T[], arrayB: T[]): T[] {
    return arrayA.filter(item => !arrayB.includes(item));
}