import {isNil} from 'lodash-es';
import mysql, {Connection, ResultSetHeader} from 'mysql2/promise';

export async function setConnection() {
  if (!isNil((global as any).connection)) {
    return;
  }

  (global as any).connection = await mysql.createConnection({
    host: process.env["DBHN"],
    user: process.env["DBUN"],
    database: process.env["DBDB"],
    password: process.env["DBPWD"],
    port: +(process.env["DBPORT"] ?? 3306),
    timezone: 'Z',
    supportBigNumbers: true,
    bigNumberStrings: false,
  });
}

export function getConnection(skipNoConnectionError = true) {
  if (skipNoConnectionError && isNil((global as any).connection)) {
    throw Error('Unable to retrieve an active MySQL connection!');
  }
  return (global as any).connection as Connection;
}

export function endConnection() {
  if (!isNil((global as any).connection)) {
    ((global as any).connection as mysql.Connection).end();
    (global as any).connection = null;
  }
}

export async function doMutation(sqlQuery: string, options: QueryOptions | null = null) {
  if (isNil(options)) {
    options = new QueryOptions();
  }

  if (!isNil((global as any).connection)) {
    try {
      await getConnection()
        .ping();
    } catch {
      await endConnection();
    }
  }

  if (isNil((global as any).connection)) {
    if (options.createConnectionWhenNoGlobalConnectionFound) {
      await await setConnection();
    } else {
      throw Error('No active MySQL connection found!');
    }
  }

  const [res] = await getConnection()
    .query(sqlQuery);
  return res as ResultSetHeader;
}

export async function doQuery<T = any>(sqlQuery: string, options: QueryOptions | null = null) {
  if (isNil(options)) {
    options = new QueryOptions();
  }

  if (!isNil((global as any).connection)) {
    try {
      await getConnection()
        .ping();
    } catch {
      await endConnection();
    }
  }

  if (isNil((global as any).connection)) {
    if (options.createConnectionWhenNoGlobalConnectionFound) {
      await await setConnection();
    } else {
      throw Error('No active MySQL connection found!');
    }
  }

  try {
    const [rows, fields] = await getConnection()
      .query(sqlQuery);
    return rows as T[];
  } catch (err: any) {
    throw Error(err.code + ': ' + err.sqlMessage + ' SQL: ' + err.sql);
  }
}

export class QueryOptions {
  createConnectionWhenNoGlobalConnectionFound = true;

  constructor() {
  }
}
