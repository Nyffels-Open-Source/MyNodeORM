import {isNil} from 'lodash-es';
import mysql, {Connection, ResultSetHeader} from 'mysql2/promise';
import {DeclarationStorage} from "../models/index.js";

/**
 * Set a new connection to the database.
 */
export async function setConnection() {
  if (!isNil((global as any).connection)) {
    return;
  }
  
  const declaration = DeclarationStorage.get().declaration;
  if (!declaration) {
    throw new Error("No declaration found.");
  }
  const options = declaration.getConnectionOptions();

  (global as any).connection = await mysql.createConnection({
    host: options.host,
    user: options.user,
    database: options.database,
    password: options.password,
    port: options.port ?? 3306,
    timezone: 'Z',
    supportBigNumbers: true,
    bigNumberStrings: false,
  });
}

/**
 * Retrieve the active MySQL connection.
 * @param skipNoConnectionError If set to true, there will be no error thrown when there is no active MySql connection known.
 */
export function getConnection(skipNoConnectionError = true) {
  if (skipNoConnectionError && isNil((global as any).connection)) {
    throw Error('Unable to retrieve an active MySQL connection!');
  }
  return (global as any).connection as Connection;
}

/**
 * End the active MySQL Connection.
 */
export async function endConnection() {
  if (!isNil((global as any).connection)) {
    await ((global as any).connection as mysql.Connection).end();
    (global as any).connection = null;
  }
}

/**
 * Do a Query Mutation (Adjusting data). The expected output is of ResultSetHeader.
 * @param sqlQuery The query you wish to execute.
 * @param options Options for this query.
 */
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
      await setConnection();
    } else {
      throw Error('No active MySQL connection found!');
    }
  }

  const [res] = await getConnection()
    .query(sqlQuery);
  return res as ResultSetHeader;
}

/**
 * Do a Query query. The expected output type can be set by the TypeParameter T.
 * @param sqlQuery The query you wish to execute.
 * @param options Options for this query.
 */
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
      await setConnection();
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