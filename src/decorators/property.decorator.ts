import 'reflect-metadata';
import {propertyType} from "../models/property.models";
import {Factory} from "../models/factory.models";

const nameMetaDatakey = Symbol('name');
const typeMetaDatakey = Symbol('type');

export function column(databaseColumnName: string) {
  return Reflect.metadata(nameMetaDatakey, databaseColumnName);
}

export function type(type: propertyType) {
  return Reflect.metadata(typeMetaDatakey, type);
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
