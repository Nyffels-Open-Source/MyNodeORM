import {DeclarationStorage, Factory} from "../models/index.js";
import {isNil} from "lodash-es";

/**
 * Convert a query result to an object.
 * @param sourceClass The class with MySQL decorations for mappping.
 * @param results The query results received from the MySQL query.
 * @returns A generated object from the sourceClass value.
 */
export function queryResultToObject<T = any>(classObject: Object, results: any[]) {
  if ((results ?? []).length <= 0) {
    return [] as T[];
  }

  const factory = new Factory();
  const targetClass = factory.create(classObject as any);
  const classProperties = Object.getOwnPropertyNames(targetClass);
  const result: any[] = [];

  (results ?? []).forEach((r) => {
    const resultObject = factory.create(classObject as any) as any;
    classProperties.forEach((p) => {
      const column = DeclarationStorage.getColumn(classObject, p);
      if (column) {
        const type = column.getType().type;

        switch (type) {
          case 'number': {
            resultObject[p] = !isNil(r[column.getDbName()]) ? +r[column.getDbName()] : null;
            break;
          }
          case 'boolean': {
            resultObject[p] = !isNil(r[column.getDbName()]) ? !!r[column.getDbName()] : null;
            break;
          }
          case 'date':
          case 'time':
          case 'datetime': {
            resultObject[p] = !isNil(r[column.getDbName()]) ? new Date(r[column.getDbName()]) : null;
            break;
          }
          default: {
            resultObject[p] = !isNil(r[column.getDbName()]) ? '' + r[column.getDbName()] : null;
            break;
          }
        }
      }
    });
    result.push(resultObject);
  });
  return (result as T[]);
}

/**
 * Check if a object has a certain property
 * @param obj Object to check
 * @param property Property to check for
 */
export const hasProperty = (obj: any, property: string) => Object.values(obj)
  .includes(property);