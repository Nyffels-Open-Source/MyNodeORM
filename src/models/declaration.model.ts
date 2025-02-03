import {Factory} from "./factory.models.js";
import {propertyType} from "./property.models.js";

abstract class DeclarationStorage {
  static declarations: { name: string, declaration: DatabaseDeclaration }[] = [];

  static add(declaration: DatabaseDeclaration) {
    if (this.declarations.find(x => x.name === declaration.name)) {
      throw new Error(`Declaration with name ${declaration.name} already exists`);
    }

    this.declarations.push({
      name: declaration.name, declaration
    });
  }

  private constructor() {}
}

export class DatabaseDeclaration {
  private _name: string;
  private _tables: DatabaseTable<any>[] = [];

  get name() {
    return this._name;
  }

  constructor(name: string = "default") {
    this._name = name;
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
}

class DatabaseTable<T> {
  private _dbName: string;
  private _columns!: DatabaseColumnCollection<T>;

  get columns() {
    return this._columns;
  }

  constructor(targetClass: any) {
    this._dbName = targetClass.constructor.name;
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

  public type(type: propertyType, length: string | null = null) {
    this._type = {type, length};
    return this;
  }

  public primary() {
    this._primary = true;
    return this;
  }

  public required() {
    this._nullable = false;
    return this;
  }

  public unique() {
    this._unique = true;
    return this;
  }

  public unsigned() {
    this._unsigned = true;
    return this;
  }

  public autoIncrement() {
    this._autoIncrement = true;
    return this;
  }

  public defaultSql(sql: string) {
    this._defaultSql = sql;
    return this;
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