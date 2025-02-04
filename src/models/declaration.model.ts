import {Factory} from "./factory.models.js";
import {propertyType} from "./property.models.js";
import {Connection} from "mysql2/promise";
import {DatabaseSchema} from "./schema.models.js";

export abstract class DeclarationStorage {
  static declarations: { name: string, declaration: DatabaseDeclaration }[] = [];

  static add(declaration: DatabaseDeclaration) {
    if (this.declarations.find(x => x.name === declaration.name)) {
      throw new Error(`Declaration with name ${declaration.name} already exists`);
    }

    this.declarations.push({
      name: declaration.name, declaration
    });
  }

  static get(name: string = "default") {
    const declaration = this.declarations.find(x => x.name === name);
    if (!declaration) {
      throw new Error(`Declaration with name ${name} not found`);
    }
    return declaration;
  }

  static getTable<T = any>(classObject: object, declarationName = "default"): DatabaseTable<T> {
    const declaration = this.declarations.find(x => x.name === declarationName);
    if (!declaration) {
      throw new Error(`Declaration with name ${declarationName} not found`);
    }

    const factory = new Factory();
    const targetClass: any = factory.create(classObject as any);
    const table = declaration.declaration.getTable(targetClass.constructor.name);
    if (!table) {
      throw new Error(`Declaration ${declarationName} with table name ${targetClass.constructor.name} not found`);
    }
    return table;
  }

  static getColumn<T = any>(classObject: object, property: keyof T, declarationName = "default"): DatabaseColumn<T> {
    const table = this.getTable(classObject, declarationName);
    const column = table.getColumn(property)
    if (!column) {
      throw new Error(`Declaration ${declarationName} with column ${property as string} not found`);
    }
    return column;
  }

  private constructor() {}
}

export function getTable(classObject: object, declarationName = "default"): string {
  return DeclarationStorage.getTable(classObject, declarationName)
    .getDbName();
}

export function getTableByName(classObjectName: string, declarationName = "default"): string {
  return DeclarationStorage.get(declarationName)
    .declaration
    .getTable(classObjectName)
    .getDbName();
}

export function getColumn<T>(classObject: object, property: keyof T, declarationName = "default"): string {
  return DeclarationStorage.getColumn(classObject, property, declarationName)
    .getDbName();
}

export function getColumnByTableName<T>(classObjectName: string, property: keyof T, declarationName = "default"): string {
  const table = DeclarationStorage.get(declarationName).declaration.getTable(classObjectName)
  if (!table) {
    throw new Error("Cant find table");
  }
  const column = table.getColumn(property);
  if (!column) {
    throw new Error("Cant find column");
  }
  return column.getDbName();
}

export class DatabaseDeclaration {
  private _name: string;
  private _tables: DatabaseTable<any>[] = [];
  private _options: ConnectionOptions

  get name() {
    return this._name;
  }

  get tables() {
    return this._tables;
  }

  getConnectionOptions() {
    return this._options;
  }

  getTable<T = any>(name: string) {
    const table = this._tables.find(t => t.name === name);
    if (!table) {
      throw new Error(`Table with name ${name} not found`);
    }
    return table as DatabaseTable<T>;
  }

  constructor(options: ConnectionOptions /* name: string = "default" // We currently restrict the library to one connection. the groundwork for multi declarations is laid, but not implemented compeletely. */) {
    this._name = "default"; // name => See text above;
    this._options = options;
    DeclarationStorage.add(this);
  }

  public declareTable<T>(classObject: object, dbTableName: string | null = null) {
    const factory = new Factory();
    const targetClass: any = factory.create(classObject as any);
    const table = new DatabaseTable<T>(targetClass);
    if (dbTableName) {
      table.dbName(dbTableName);
    }
    this._tables.push(table);
    return table;
  }

  public convertToDatabaseSchema() {
    const schema: DatabaseSchema = {};
    for (const table of this._tables) {
      schema[table.getDbName()] = {columns: {}};
      for (const columnname of Object.keys(table.columns)) {
        const column = table.columns[columnname];
        if (!column) {
          continue;
        }
        const foreignKey = column.getForeignKey();

        // @ts-ignore
        schema[table.getDbName()].columns[column.getDbName()] = {
          type: column.getType().type,
          primary: column.getPrimary(),
          nullable: column.getNullable(),
          unique: column.getUnique(),
          unsigned: column.getUnsigned(),
          autoIncrement: column.getAutoIncrement(),
          defaultSql: column.getDefaultSql(),
          foreignKey: foreignKey ? {
            table: getTableByName(foreignKey.table),
            column: getColumnByTableName(foreignKey.table, foreignKey.column),
            onDelete: foreignKey.onDelete,
            onUpdate: foreignKey.onUpdate,
          } : null
        };
      }
    }
    return schema;
  }
}

class DatabaseTable<T> {
  private _dbName: string;
  private _name: string;
  private _columns!: DatabaseColumnCollection<T>;

  get columns() {
    return this._columns;
  }

  getColumn(name: keyof T) {
    const column = this._columns[name as keyof T];
    if (!column) {
      throw new Error(`column name ${name as string} not found`);
    }
    return column;
  }

  get name() {
    return this._name;
  }

  getDbName() {
    return this._dbName;
  }

  constructor(targetClass: any) {
    this._dbName = targetClass.constructor.name;
    this._name = targetClass.constructor.name;
    this._columns = {} as DatabaseColumnCollection<T>;
    for (const column of Object.keys(targetClass)) {
      // @ts-ignore
      this._columns[column] = new DatabaseColumn<T>(column as keyof T);
    }
  }

  public dbName(name: string) {
    this._dbName = name;
  }
}

export type DatabaseColumnCollection<T> = {
  [column in keyof T]: DatabaseColumn<T>;
};

class DatabaseColumn<T> {
  private _dbName: string;
  private _type: { type: propertyType, length: string | null } = {type: "string", length: null};
  private _primary: boolean = false;
  private _nullable: boolean = true;
  private _unique: boolean = false;
  private _unsigned: boolean = false;
  private _autoIncrement: boolean = false;
  private _defaultSql: string | null = null;
  private _foreignKey: foreignKey | null = null;

  constructor(property: keyof T) {
    this._dbName = property as string;
  }

  public dbName(name: string) {
    this._dbName = name;
    return this;
  }

  getDbName() {
    return this._dbName;
  }

  public type(type: propertyType, length: string | null = null) {
    this._type = {type: type ?? "string", length};
    return this;
  }

  getType() {
    return this._type;
  }

  public primary() {
    this._primary = true;
    return this;
  }

  getPrimary() {
    return this._primary;
  }

  public required() {
    this._nullable = false;
    return this;
  }

  getRequired() {
    return !this._nullable;
  }

  getNullable() {
    return this._nullable;
  }

  public unique() {
    this._unique = true;
    return this;
  }

  getUnique() {
    return this._unique;
  }

  public unsigned() {
    this._unsigned = true;
    return this;
  }

  getUnsigned() {
    return this._unsigned;
  }

  public autoIncrement() {
    this._autoIncrement = true;
    return this;
  }

  getAutoIncrement() {
    return this._autoIncrement;
  }

  public defaultSql(sql: string) {
    this._defaultSql = sql;
    return this;
  }

  getDefaultSql() {
    return this._defaultSql;
  }

  public foreignKey<MT>(classObject: object, matchProperty: keyof MT, onDelete = ForeignKeyOption.Cascade, OnUpdate = ForeignKeyOption.Cascade) {
    const factory = new Factory();
    const targetClass: any = factory.create(classObject as any);

    this._foreignKey = {
      table: targetClass.constructor.name,
      column: matchProperty as string,
      onDelete: onDelete,
      onUpdate: OnUpdate,
    };
    return this;
  }

  getForeignKey() {
    return this._foreignKey;
  }
}

interface foreignKey {
  table: string;
  column: string;
  onDelete: ForeignKeyOption;
  onUpdate: ForeignKeyOption;
}

export enum ForeignKeyOption {
  Restrict = 0,
  Cascade = 1,
  SetNull = 2
}

export interface ConnectionOptions {
  host: string,
  user: string,
  database: string,
  password: string,
  port?: number,
}