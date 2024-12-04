import 'reflect-metadata';
import {propertyType} from "../models/property.models";
import {Factory} from "../models/factory.models";
import {parseNumber} from "../logic";

const nameMetaDatakey = Symbol('name');
const typeMetaDatakey = Symbol('type');
const primaryMetaDatakey = Symbol('primary');
const nullableMetaDatakey = Symbol('nullable');
const uniqueMetaDatakey = Symbol('unique');
const unsignedMetaDatakey = Symbol('unsigned');
const autoIncrementMetaDatakey = Symbol('autoIncrement');
const defaultMetaDatakey = Symbol('default');
const foreignKeyMetaDatakey = Symbol('foreignKey');

export function column(databaseColumnName: string) {
  return Reflect.metadata(nameMetaDatakey, databaseColumnName);
}

export function type(type: propertyType, length: string | null = null) {
  return Reflect.metadata(typeMetaDatakey, JSON.stringify({type, length}));
}

export function primary() {
  return Reflect.metadata(primaryMetaDatakey, true);
}

export function nullable(isNullable: boolean = true) {
  return Reflect.metadata(nullableMetaDatakey, isNullable);
}

export function unique() {
  return Reflect.metadata(uniqueMetaDatakey, true);
}

export function unsigned() {
  return Reflect.metadata(unsignedMetaDatakey, true);
}

export function autoIncrement() {
  return Reflect.metadata(autoIncrementMetaDatakey, true);
}

export function defaultSql(sql: string) {
  return Reflect.metadata(defaultMetaDatakey, sql);
}

export function foreignKey<T>(table: object, column: keyof T, onDelete: ForeignKeyOption = ForeignKeyOption.Restrict, onUpdate: ForeignKeyOption = ForeignKeyOption.Restrict) {
  return Reflect.metadata(foreignKeyMetaDatakey, JSON.stringify({table, column, onDelete, onUpdate}));
}

/**
 * Options for a foreign key connection
 */
export enum ForeignKeyOption {
  Restrict = 0,
  Cascade = 1,
  SetNull = 2,
  NoAction = 3
}

/**
 * Get a sql column from a property. If no column decorator found, it will return the propertykey.
 */
export function getColumn<T>(sourceObject: Object, propertyKey: keyof T) {
  try {
    const factory = new Factory();
    const targetClass = factory.create<T>(sourceObject as any);

    return Reflect.getMetadata(nameMetaDatakey, (targetClass as any), propertyKey as string) as string;
  } catch (ex) {
    return propertyKey as string;
  }
}

/**
 * Get all the properties of a object.
 */
export function getAllProperties<T>(object: Object) {
  const factory = new Factory();
  const targetClass = factory.create<T>(object as any);

  return Object.keys(targetClass as any) as (keyof T)[];
}

/**
 * Get the column type from a property. If no type decorator found, it will return 'string'.
 */
export function getType<T>(sourceObject: Object, propertyKey: keyof T): propertyType {
  try {
    const factory = new Factory();
    const targetClass = factory.create<T>(sourceObject as any);

    const stringifiedValue = Reflect.getMetadata(typeMetaDatakey, (targetClass as any), propertyKey as string);
    return JSON.parse(stringifiedValue).type;
  } catch (ex) {
    return 'string';
  }
}

export function getSqlType<T>(sourceObject: Object, propertyKey: keyof T): string {
  try {
    const factory = new Factory();
    const targetClass = factory.create<T>(sourceObject as any);

    const stringifiedValue = Reflect.getMetadata(typeMetaDatakey, (targetClass as any), propertyKey as string);
    let type: propertyType;
    let length  = "";
    if (stringifiedValue == undefined) {
      type = "string";
      length = "255";
    } else {
      type = JSON.parse(stringifiedValue).type;
      length = JSON.parse(stringifiedValue).length;
    }

    switch (type) {
      case "string": {
        const strLength = +(length ?? "255");
        if (Number.isNaN(strLength)) {
          console.error(`❌ Could not parse type length in property '${propertyKey.toString()}' in class '${(targetClass as any).constructor.name}'.`);
          process.exit(1);
        }

        if (strLength <= 0) {
          console.error(`❌ Length cannot be lesser than 1 for type string in property '${propertyKey.toString()}' in class '${(targetClass as any).constructor.name}'.`)
          process.exit(1);
        }

        if (strLength > 65535) {
          return "LONGTEXT";
        } else {
          return `VARCHAR(${strLength})`;
        }
      }
      case "bigstring": {
        return "LONGTEXT";
      }
      case "guid": {
        return "VARCHAR(36)";
      }
      case "number": {
        return ""; // TODO
      }
      case "boolean": {
        return ""; // TODO
      }
      case "date": {
        return ""; // TODO
      }
      case "datetime": {
        return ""; // TODO
      }
      default: {
        console.error(`❌ MyNodeORM type '${type}' given in property '${propertyKey.toString()}' in class '${(targetClass as any).constructor.name}' is not known to MyNodeORM.'`);
        process.exit(1);
      }
    }
  } catch (ex) {
    return "VARCHAR(255)"; // Default to VARCHAR max length
  }
}

export function getTypeLength<T>(sourceObject: Object, propertyKey: keyof T): string | null {
  try {
    const factory = new Factory();
    const targetClass = factory.create<T>(sourceObject as any);

    const stringifiedValue = Reflect.getMetadata(typeMetaDatakey, (targetClass as any), propertyKey as string);
    return JSON.parse(stringifiedValue).length;
  } catch (ex) {
    return null;
  }
}

export function getPrimary<T>(sourceObject: Object, propertyKey: keyof T): boolean {
  try {
    const factory = new Factory();
    const targetClass = factory.create<T>(sourceObject as any);

    return Reflect.getMetadata(primaryMetaDatakey, (targetClass as any), propertyKey as string).toLowerCase() == "true";
  } catch (ex) {
    return false;
  }
}

export function getNullable<T>(sourceObject: Object, propertyKey: keyof T): boolean {
  try {
    const factory = new Factory();
    const targetClass = factory.create<T>(sourceObject as any);

    return Reflect.getMetadata(nullableMetaDatakey, (targetClass as any), propertyKey as string).toLowerCase() == "true";
  } catch (ex) {
    return true;
  }
}

export function getUnique<T>(sourceObject: Object, propertyKey: keyof T): boolean {
  try {
    const factory = new Factory();
    const targetClass = factory.create<T>(sourceObject as any);

    return Reflect.getMetadata(uniqueMetaDatakey, (targetClass as any), propertyKey as string).toLowerCase() == "true";
  } catch (ex) {
    return true;
  }
}

export function getUnsigned<T>(sourceObject: Object, propertyKey: keyof T): boolean {
  try {
    const factory = new Factory();
    const targetClass = factory.create<T>(sourceObject as any);

    return Reflect.getMetadata(unsignedMetaDatakey, (targetClass as any), propertyKey as string).toLowerCase() == "true";
  } catch (ex) {
    return true;
  }
}

export function getAutoIncrement<T>(sourceObject: Object, propertyKey: keyof T): boolean {
  try {
    const factory = new Factory();
    const targetClass = factory.create<T>(sourceObject as any);

    return Reflect.getMetadata(autoIncrementMetaDatakey, (targetClass as any), propertyKey as string).toLowerCase() == "true";
  } catch (ex) {
    return true;
  }
}

export function getDefaultSql<T>(sourceObject: Object, propertyKey: keyof T): string | null {
  try {
    const factory = new Factory();
    const targetClass = factory.create<T>(sourceObject as any);

    return Reflect.getMetadata(defaultMetaDatakey, (targetClass as any), propertyKey as string);
  } catch (ex) {
    return null;
  }
}