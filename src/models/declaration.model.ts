import {Factory} from "./factory.models.js";
import {propertyType} from "./property.models.js";

export class DatabaseDeclaration {
  private _name: string;

  constructor(name: string = "default") {
    this._name = name;
  }

  public declareTable<T>(classObject: object, dbTableName: string) {
    const factory = new Factory();
    const targetClass: any = factory.create(classObject as any);
    return new DatabaseTable<T>(targetClass);
  }

  public commit() {
    // TODO Save in runtime
  }
}

class DatabaseTable<T> {
  private _dbName: string;
  private _columns!: DatabaseColumnCollection<T>;

  constructor(targetClass: any) {
    this._dbName = targetClass.constructor.name;
    const columns = Object.keys(targetClass);
  }

  private dbName(name: string) {
    this._dbName = name;
  }

  declareColumn(property: keyof T, dbColumnName: string) {}
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