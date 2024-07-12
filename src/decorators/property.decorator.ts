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

export function getColumn(sourceObject: any, propertyKey: string) {
  try {
    const factory = new Factory();
    const targetClass = factory.create(sourceObject);

    return Reflect.getMetadata(nameMetaDatakey, (targetClass as any), propertyKey);
  } catch (ex) {
    console.error(`Property '${propertyKey}' not found and will return null or be filtered out of the query`);
    return null;
  }
}

export function getType(sourceObject: any, propertyKey: string): propertyType {
  try {
    const factory = new Factory();
    const targetClass = factory.create(sourceObject);

    return Reflect.getMetadata(typeMetaDatakey, (targetClass as any), propertyKey);
  } catch (ex) {
    return 'string';
  }
}
