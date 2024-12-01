import 'reflect-metadata';
import {propertyType} from "../models/property.models";
import {Factory} from "../models/factory.models";

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

export function type(type: propertyType) {
  return Reflect.metadata(typeMetaDatakey, type);
}

export function primary() {
  return Reflect.metadata(primaryMetaDatakey, true);
}

export function nullable(isNullable: boolean) {
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

export function foreignKey<T>(table: T, column: keyof T) {
  return Reflect.metadata(foreignKeyMetaDatakey, JSON.stringify({table, column}));
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

    return Reflect.getMetadata(typeMetaDatakey, (targetClass as any), propertyKey as string);
  } catch (ex) {
    return 'string';
  }
}
