import 'reflect-metadata';
import {Factory} from "../models";

const tableMetaDataKey = Symbol('table');
export function table(datebaseTableName: string) {
  return Reflect.metadata(tableMetaDataKey, datebaseTableName);
}
export function getTable(sourceObject: any) {
  const factory = new Factory();
  const targetClass = factory.create(sourceObject);

  try {
    return Reflect.getMetadata(tableMetaDataKey, (targetClass as any).constructor);
  } catch (ex) {
    console.error(`Table not known for type '${(targetClass as any).constructor.name}'`);
    return null;
  }
}

interface ITableIdentification {
  id: string;
  object: any;
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
  return object ? object.object : null;
}