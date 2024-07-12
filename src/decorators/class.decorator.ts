import 'reflect-metadata';
import {Factory} from "../models/factory.models";
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