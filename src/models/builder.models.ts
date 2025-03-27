import {doMutation, doQuery, parseValue, queryResultToObject} from "../logic/index.js";
import {Factory} from "./factory.models.js";
import {isNil, isArray, uniq} from "lodash-es";
import {DeclarationStorage, getColumn, getTable} from "./declaration.model.js";

/**
 * Build a query with a simple query builder using all the class decorations and wrapper logic available in this package.
 */
export class QueryBuilder<T> {
  private _classobject: object;

  private _selectQueryString: string = "*";
  private _insertQueryString: string | null = null;
  private _updateQueryString: string | null = null;
  private _orderByQueryString: string | null = null;
  private _limitByQueryString: string | null = null;
  private _whereGroups: { group: WhereGroup<T>, parentId: string | null }[] = [];
  private _whereRawGroups: { query: string, parentId: string | null }[] = [];
  private _groupByValue: string | null = null;

  private _single = false;
  private _queryType: 'SELECT' | 'UPDATE' | 'INSERT' | 'DELETE' = 'SELECT';
  private _joins: JoinValue<any, any>[] = [];

  private _isCount = false;
  private _isSum = false;
  private _isMin = false;
  private _isMax = false;
  private _isAvg = false;

  /**
   * Create a querybuilder for easy and fast query building based on the decoration methode for links between class properties and database columns
   * @param classobject The object with the decorators
   */
  constructor(classobject: object) {
    this._classobject = classobject;
  }

  /* Builders */

  /**
   * Add the fields by property keys of the loaded class to the select query.
   */
  public select(properties: (keyof T | SelectValue<T>)[] = [], allowSelectAll = true) {
    if ((properties ?? []).length <= 0) {
      if (allowSelectAll === true) {
        this._selectQueryString = "*";
        return this;
      } else {
        properties = Object.keys(DeclarationStorage.getTable<T>(this._classobject).columns) as (keyof T | SelectValue<T>)[];
      }
    }

    const columns = properties.map(p => {
      if ((typeof p) === "string") {

        try {
          const column = DeclarationStorage.getColumn(this._classobject, p as string).getDbName();
          const table = DeclarationStorage.getTable(this._classobject).getDbName();
          return `${table}.${column}`;
        } catch {
          return "";
        }
      } else {
        try {
          const keys = Object.keys(p);
          if (!keys.includes('property')) {
            throw new Error('Incorrect selectValue object');
          }
          
          try {
            const classobject = (p as SelectValue<T>).table;
            const table = DeclarationStorage.getTable(classobject ?? this._classobject).getDbName();
            const column = DeclarationStorage.getColumn(classobject ?? this._classobject, (p as SelectValue<T>).property as string).getDbName();
            const noAliasQueryFragment = `${table}.${column}`;
            return ((p as SelectValue<T>).alias ?? "").length > 0 ? `${noAliasQueryFragment} AS ${(p as SelectValue<T>).alias}` : noAliasQueryFragment;
          } catch {
            return "";
          }
        } catch (err) {
          console.warn(err);
          return "";
        }
      }
    })
      .filter(x => (x ?? '').length > 0);
    this._selectQueryString = columns.filter(c => c !== null)
      .join(", ");
    this._queryType = 'SELECT';
    return this;
  }

  /**
   * Give a raw query that will be pasted as is in between SELECT and FROM.
   */
  public selectRaw(selectQuery: string) {
    this._queryType = "SELECT";
    this._selectQueryString = selectQuery;
    return this;
  }

  /**
   * Create a count select query. The result of the execute will now be the counted result with type of number. The only accepted type parameter for execute function in combination with count is number.
   */
  public count() {
    this._queryType = "SELECT";
    this._selectQueryString = `COUNT(*) as count`;
    this._isCount = true;
    this.single();
    return this;
  }

  /**
   * Create a sum select query. The result of the execute will be a summed value with type of number. The only accepted type parameter for execute function in combination with sum is number.
   * @param field The field you wish to take the sum of.
   */
  public sum(field: (keyof T)) {
    this._queryType = "SELECT";
    this._selectQueryString = `SUM(${DeclarationStorage.getColumn(this._classobject, field as string).getDbName()}) as sum`;
    this._isSum = true;
    this.single();
    return this;
  }

  /**
   * Create a min select query. The result of the execute will be the minimum value of the fields you compared with type of number. The only accepted type parameter for execute function in combination with min is number.
   * @param field The field you wish to take the min of.
   */
  public min(field: (keyof T)) {
    this._queryType = "SELECT";
    this._selectQueryString = `MIN(${DeclarationStorage.getColumn(this._classobject, field as string).getDbName()}) as min`;
    this._isMin = true;
    this.single();
    return this;
  }

  /**
   * Create a max select query. The result of the execute will be the maximum value of the fields you compared with type of number. The only accepted type parameter for execute function in combination with max is number.
   * @param field The field you wish to take the min of.
   */
  public max(field: (keyof T)) {
    this._queryType = "SELECT";
    this._selectQueryString = `MAX(${DeclarationStorage.getColumn(this._classobject, field as string).getDbName()}) as max`;
    this._isMax = true;
    this.single();
    return this;
  }

  /**
   * Create a avg select query. The result of the execute will be the average value of the fields you compared with type of number. The only accepted type parameter for execute function in combination with avg is number.
   * @param field The field you wish to take the min of.
   */
  public avg(field: (keyof T)) {
    this._queryType = "SELECT";
    this._selectQueryString = `AVG(${DeclarationStorage.getColumn(this._classobject, field as string).getDbName()}) as avg`;
    this._isAvg = true;
    this.single();
    return this;
  }

  /**
   * Create an insert query from a with data populated object based on the object given on creation of the QueryBuilder.
   * @param source The object with the decorators
   * @param onlyIncludeSourceProperties skip properties that are not present from the insert query.
   */
  public insert(source: InsertValue<T> | InsertValue<T>[], onlyIncludeSourceProperties = true) {
    this._queryType = "INSERT";

    if (!isArray(source)) {
      source = [source] as any[];
    }

    const factory = new Factory();
    const targetClass = factory.create(this._classobject as any);

    const properties: string[] = onlyIncludeSourceProperties ? Object.keys((source as any[]).find(x => x)) : Object.keys(targetClass as any);
    const columns = properties.map(p => DeclarationStorage.getColumn(this._classobject, p).getDbName());

    const valuesFragments: string[] = [];

    for (const s of
      source) {
      const values: string[] = [];

      for (const property of
        properties) {
        const value = parseValue(this._classobject, property, (s as any)[property]);
        values.push(value as any);
      }

      valuesFragments.push(`(${values.join(', ')})`);
    }

    this._insertQueryString = `(${columns.join(', ')}) VALUES ${valuesFragments.join(', ')}`;
    return this;
  }

  /**
   * Do a insert query based on a raw query. Do not include the INSERT INTO {table} part of the query. Only the field and VALUES part.
   */
  public insertRaw(insertQuery: string) {
    this._queryType = "INSERT";
    this._insertQueryString = insertQuery;
    return this;
  }

  /**
   * Create a update query from a with data populated object base on the object given on creation of the QueryBuilder.
   * @param source The object with the docarators
   * @param onlyIncludeSourceProperties skip properties that are not present from the update query.
   */
  public update(source: UpdateValue<T>, onlyIncludeSourceProperties = true) {
    this._queryType = "UPDATE";

    let sourceProperties: string[] = [];
    if (onlyIncludeSourceProperties) {
      sourceProperties = Object.keys(source);
    }
    const factory = new Factory();
    const targetClass = factory.create(this._classobject as any);

    const fragments: string[] = [];
    const properties = Object.keys(targetClass as any);

    for (const property of
      properties) {
      if (onlyIncludeSourceProperties && !sourceProperties.includes(property)) {
        continue;
      }

      const column = DeclarationStorage.getColumn(this._classobject, property).getDbName();
      const value = parseValue(this._classobject, property, (source as any)[property]);
      fragments.push(`${column} = ${value}`);
    }

    this._updateQueryString = fragments.join(", ");
    return this;
  }

  /**
   * Do a update query based on a raw query. Do not include UPDATE {table} SET part of the query. Only the field and values parts after SET must be included and no WHERE or filtering.
   * @param updateQuery
   */
  public updateRaw(updateQuery: string) {
    this._queryType = "UPDATE";
    this._updateQueryString = updateQuery;
    return this;
  }

  /**
   * Mark the build query as a Delete query.
   */
  public delete() {
    this._queryType = "DELETE";
    return this;
  }

  /**
   * Create a where Query. Multiple Where functions are allowed and will be combined with the OR element.
   * Every group is an isolated logic with different values that ae combined with the AND element.
   * @param group The where group existing from one or multiple properties.
   */
  public where(group: WhereGroup<T>, parentId: string | null = null) {
    this._whereGroups.push({
      parentId: parentId,
      group: group
    });
    return this;
  }

  /**
   * Give a raw query that will be pasted in the where group and be combined with the other where's with the OR element.
   * @param whereQuery
   */
  public whereRaw(raw: string, parentId: string | null = null) {
    this._whereRawGroups.push({
      query: raw,
      parentId: parentId
    });

    return this;
  }

  /**
   * Generate the group by part of a query
   * @param property The property your query has to group by
   */
  public groupBy(property: string, table?: any | string) {
    const columnQuery = DeclarationStorage.getColumn(this._classobject, property).getDbName();
    const tableQuery = DeclarationStorage.getTable(table ?? this._classobject).getDbName();

    this._groupByValue = `${tableQuery}.${columnQuery}`;
    return this;
  }

  /**
   * Generate the order by port of a query.
   * @param properties The properties of the class you wish to use to create the order by.
   * @param direction The direction of the order (ASC / DESC)
   */
  public orderBy(properties: (keyof T) | (keyof T)[] | OrderByValue<T>) {
    if (isArray(properties)) {
      const columns = properties.map(p => DeclarationStorage.getColumn(this._classobject, p as string).getDbName());
      this._orderByQueryString = `ORDER BY ${columns.join(', ')}`;
    } else if (typeof properties === 'object') {
      const cProperties = Object.keys(properties);
      this._orderByQueryString = `ORDER BY ${cProperties.map(prop => {
        const content = (properties as any)[prop];
        let classobject = (properties as any)[prop].table ?? this._classobject;
        if (!isNil(content.table)) {
          classobject = content.table;
        }
        return `${DeclarationStorage.getTable(classobject as object)
          .getDbName()}.${DeclarationStorage.getColumn(classobject as object, prop)
          .getDbName()} ${content.direction}`
      })
        .join(', ')}`;
    } else {
      const table = DeclarationStorage.getTable(this._classobject)
        .getDbName();
      const column = [DeclarationStorage.getColumn(this._classobject, properties as string)
        .getDbName()];
      this._orderByQueryString = `ORDER BY ${table}.${column}`;
    }

    return this;
  }

  /**
   * Give a raw query that will be pasted in the orderBy part.
   * @param whereQuery
   */
  public orderByRaw(orderByQuery: string) {
    this._orderByQueryString = `ORDER BY ${orderByQuery}`;
    return this;
  }

  /**
   * Generate a Join sql query parts.
   */
  public join<source, target>(joinValue: JoinValue<source, target>) {
    this._joins.push(joinValue);
    return this;
  }

  /**
   * Generate the limit, with offset option, part of the query.
   * This function disables the function "single".
   * @param limit The limit of the rows you wisch to fetch
   * @param offset The offset of rows you wish to skip
   */
  public limit(limit: number, offset: number | null = null) {
    this._limitByQueryString = `LIMIT ${limit}`;
    if (offset !== null) {
      this._limitByQueryString += ` OFFSET ${offset}`;
    }

    this._single = false;
    return this;
  }

  /**
   * Mark this builder as a single value request
   * This does not work together with the function "limit";
   */
  public single() {
    this._limitByQueryString = 'LIMIT 1';
    this._single = true;
    return this;
  }

  /* Outputs */
  public generateQuery() {
    switch (this._queryType) {
      case 'SELECT':
        return this.generateSelectQuery();
      case 'UPDATE':
        return this.generateUpdateQuery()
      case 'DELETE':
        return this.generateDeleteQuery();
      case "INSERT":
        return this.generateInsertQuery();
    }
  }

  /**
   * Convert the wheregroup array to the where string.
   */
  private convertWheregroupsToWhereString() {
    for (const group of
      this._whereGroups) {
      const propertyFragments: string[] = [];
      for (const property of
        Object.keys(group.group)) {
        let content = (group.group as any)[property];

        if (typeof content !== "object" || isArray(content) || content === null || content.constructor.name === 'DatabaseSystemValue') {
          content = {value: content};
        }

        let dbColumn = "";
        let dbTable = "";
        let dbClassobject;
        if (!isNil(content.table)) {
          dbColumn = DeclarationStorage.getColumn(content.table, property)
            .getDbName();
          dbTable = DeclarationStorage.getTable(content.table)
            .getDbName();
          dbClassobject = content.table;
        } else {
          dbColumn = DeclarationStorage.getColumn(this._classobject, property)
            .getDbName();
          dbTable = DeclarationStorage.getTable(this._classobject)
            .getDbName();
          dbClassobject = this._classobject;
        }

        if (isArray(content.value)) {
          if (isNil(content.type)) {
            content.type = WhereCompareType.IN;
          }

          switch (content.type) {
            case WhereCompareType.BETWEEN:
            case WhereCompareType.NOTBETWEEN: {
              propertyFragments.push(`${dbTable}.${dbColumn} ${content.type} ${parseValue(this._classobject, property, content.value[0])} AND ${parseValue(dbClassobject, property, content.value[1])}`);
              break;
            }
            case WhereCompareType.IN:
            case WhereCompareType.NOTIN: {
              propertyFragments.push(`${dbTable}.${dbColumn} ${content.type} (${content.value.map((v: any) => parseValue(dbClassobject, property, v))
                .join(", ")})`);
              break;
            }
          }
        } else {
          if (isNil(content.type)) {
            content.type = WhereCompareType.EQUAL;
          }

          const parsedValue = parseValue(dbClassobject, property, content.value);
          if (parsedValue == "NULL" && content.type == WhereCompareType.EQUAL) {
            content.type = "IS";
          } else if (parsedValue == "NULL" && content.type == WhereCompareType.NOTEQUAL) {
            content.type = "IS NOT";
          }

          if (!isNil(content.orNull) && content.orNull === true) {
            propertyFragments.push(`(${dbTable}.${dbColumn} ${content.type} ${parsedValue} OR ${dbTable}.${dbColumn} IS NULL)`);
          } else {
            propertyFragments.push(`${dbTable}.${dbColumn} ${content.type} ${parsedValue}`);
          }
        }
      }
      this._whereRawGroups.push({
        parentId: group.parentId,
        query: propertyFragments.join(" AND ")
      });
    }


    const parentGroups: string[] = [];
    for (const parentId of
      uniq(this._whereRawGroups.map(f => f.parentId))) {
      parentGroups.push("(" + this._whereRawGroups.filter(g => g.parentId == parentId)
        .map(g => g.query)
        .join(" OR ") + ")");
    }
    return parentGroups.length > 0 ? ` WHERE ${parentGroups.join(" AND ")}` : '';
  }

  /**
   * Generate a select query.
   */
  private generateSelectQuery() {
    let query = `SELECT ${this._selectQueryString ?? "*"}
                 FROM ${DeclarationStorage.getTable(this._classobject)
                         .getDbName()}`;

    for (const join of
      this._joins) {
      query += ` ${join.type ?? "LEFT"} JOIN ${DeclarationStorage.getTable(join.table)
        .getDbName()}`;
      if (!isArray(join.on)) {
        join.on = [join.on];
      }
      for (const onValue of
        join.on) {
        query += ` ON ${DeclarationStorage.getTable(this._classobject)
          .getDbName()}.${DeclarationStorage.getColumn(this._classobject, (onValue.sourceProperty as string))
          .getDbName()} = ${DeclarationStorage.getTable(join.table)
          .getDbName()}.${DeclarationStorage.getColumn(join.table, (onValue.targetProperty as string))
          .getDbName()}`;
      }
    }

    query += `${this.convertWheregroupsToWhereString()}`;

    if (this._groupByValue !== null) {
      query += ` GROUP BY ${this._groupByValue}`;
    }

    if (this._orderByQueryString !== null) {
      query += ' ' + this._orderByQueryString;
    }

    if (this._limitByQueryString !== null) {
      query += ' ' + this._limitByQueryString;
    }

    return query;
  }

  /**
   * Generate a insert query.
   */
  private generateInsertQuery() {
    return `INSERT INTO ${DeclarationStorage.getTable(this._classobject)
            .getDbName()} ${this._insertQueryString}`;
  }

  /**
   * Generate a delete query
   */
  private generateDeleteQuery() {
    let query = `DELETE
                 FROM ${DeclarationStorage.getTable(this._classobject)
                         .getDbName()}`;
    query += `${this.convertWheregroupsToWhereString()}`;
    return query;
  }

  /**
   * Generate a update query
   */
  private generateUpdateQuery() {
    let query = `UPDATE ${DeclarationStorage.getTable(this._classobject)
            .getDbName()}
                 SET ${this._updateQueryString}`;
    query += `${this.convertWheregroupsToWhereString()}`;
    return query;
  }

  /**
   * Execute the builded query.
   */
  public async execute<T = any>(table: object = this._classobject): Promise<T> {
    switch (this._queryType) {
      case 'SELECT': {
        const selectQuery = this.generateSelectQuery();
        const queryRes = await doQuery(selectQuery);
        if (this._isCount) {
          return queryRes.find(x => x).count as T;
        } else if (this._isSum) {
          return queryRes.find(x => x).sum as T;
        } else if (this._isMin) {
          return queryRes.find(x => x).min as T;
        } else if (this._isMax) {
          return queryRes.find(x => x).max as T;
        } else if (this._isAvg) {
          return queryRes.find(x => x).avg as T;
        } else if (this._single) {
          const res = queryResultToObject<typeof table>(table, queryRes);
          return res.find(x => x) as T;
        } else {
          const res = queryResultToObject<typeof table>(table, queryRes);
          return res as typeof this._classobject[] as any;
        }
      }
      case 'UPDATE': {
        const updateQuery = this.generateUpdateQuery()
        return await doMutation(updateQuery) as any;
      }
      case 'DELETE': {
        const deleteQuery = this.generateDeleteQuery();
        return await doMutation(deleteQuery) as any;
      }
      case "INSERT": {
        const insertQuery = this.generateInsertQuery();
        return await doMutation(insertQuery) as any;
      }
    }
  }
}

/**
 * Value used for building a select query.
 */
export class SelectValue<T> {
  public property!: keyof T;
  public alias?: string;
  public table?: object;
}

/**
 * The value of building a order query.
 */
export type OrderByValue<T> = {
  [key in keyof T]?: {
    direction?: OrderByDirection,
    table?: object | string
  }
}

/**
 * Direction enum for order by parts in queries.
 */
export enum OrderByDirection {
  ASC = 'ASC',
  DESC = 'DESC'
}

/**
 * A group used to create a where value string.
 */
export type WhereGroup<T> = {
  [key in keyof T]?: {
                       value: T[key] | T[key][],
                       type?: WhereCompareType,
                       table?: object | string,
                       orNull?: boolean
                     } | T[key] | T[key][]
}

/**
 * A value for an update query.
 */
export type UpdateValue<T> = {
  [key in keyof T]?: T[key]
}

/**
 * A value for an insert query.
 */
export type InsertValue<T> = {
  [key in keyof T]?: T[key]
}

/**
 * A join value to join 2 tables.
 */
export class JoinValue<source, target> {
  table!: object;
  on!: joinOnValue<source, target> | joinOnValue<source, target>[];
  type?: "INNER" | "LEFT" | "RIGHT" | "CROSS" = "LEFT"
}

interface joinOnValue<source, target> {
  sourceProperty: keyof source;
  targetProperty: keyof target;
}


/**
 * Compare types for a where value.
 */
export enum WhereCompareType {
  EQUAL = "=",
  NOTEQUAL = "!=",
  LESS = "<",
  LESSEQUAL = "<=",
  GREATER = ">",
  GREATEREQUAL = ">=",
  LIKE = "LIKE",
  NOTLIKE = "NOT LIKE",
  IN = "IN",
  NOTIN = "NOT IN",
  BETWEEN = "BETWEEN",
  NOTBETWEEN = "NOT BETWEEN"
}