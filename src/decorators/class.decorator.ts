import 'reflect-metadata';
import {Factory} from "../models/index.js";

const tableMetaDataKey = Symbol('table');

export function table(datebaseTableName: string) {
  return Reflect.metadata(tableMetaDataKey, datebaseTableName);
}

export function getTable(sourceObject: Object) {
  const factory = new Factory();
  const targetClass = factory.create(sourceObject as any);

  try {
    return Reflect.getMetadata(tableMetaDataKey, (targetClass as any).constructor) as string;
  } catch (ex) {
    console.error(`Table not known for type '${(targetClass as any).constructor.name}'`);
    return "";
  }
}

interface ITableIdentification {
  id: string;
  object: Object;
}

export const TableIdentifications: ITableIdentification[] = [];
const tableIdMetadataKey = "table-id-";

export function id(id: string, object: any) {
  TableIdentifications.push({
    id, object
  });
  return Reflect.metadata(tableIdMetadataKey + id, object);
}

export function getObjectById(id: string) {
  const object = TableIdentifications.find(x => x.id === id);
  return object ? object.object as Object : null;
}