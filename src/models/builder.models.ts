import {getColumn, getTable, getType} from "../decorators";
import _ from "lodash";
import {doMutation, doQuery, parseValue, queryResultToObject} from "../logic";
import {Factory} from "./factory.models";

/**
 * Build a query with a simple query builder using all the class decorations and wrapper logic available in this package.
 */
export class QueryBuilder {
  private _classObject: any;

  private _selectQueryString: string = "*";
  private _insertQueryString: string | null = null;
  private _updateQueryString: string | null = null;
  private _orderByQueryString: string | null = null;
  private _limitByQueryString: string | null = null;
  private _whereGroups: { group: WhereGroup, parentId: string | null }[] = [];
  private _whereRawGroups: { query: string, parentId: string | null }[] = [];

  private _single = false;
  private _queryType: 'SELECT' | 'UPDATE' | 'INSERT' | 'DELETE' = 'SELECT';

  /**
   * Create a querybuilder for easy and fast query building based on the decoration methode for links between class properties and database columns
   * @param classObject The object with the decorators
   */
  constructor(classObject: any) {
    this._classObject = classObject;
  }

  /* Builders */

  /**
   * Add the fields by property keys of the loaded class to the select query.
   */
  public select(properties: (string | SelectValue)[] = []) {
    if ((properties ?? []).length <= 0) {
      this._selectQueryString = "*"
      return this;
    }

    const columns: string[] = properties.map(p => {
      if ((typeof p) === "string") {
        return getColumn(this._classObject, p as string);
      } else {
        try {
          const keys = Object.keys(p);
          if (!keys.includes('property') || !keys.includes('alias')) {
            throw new Error('Incorrect selectValue object');
          }
          return `${getColumn(this._classObject, (p as SelectValue).property)} AS ${(p as SelectValue).alias}`;
        } catch (err) {
          console.warn(err);
          return null;
        }
      }
    });
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
   * Create a count select query.
   */
  public count(alias: string = "count") {
    this._queryType = "SELECT";
    this._selectQueryString = `COUNT(*) as ${alias}`;
    this.single();
    return this;
  }

  /**
   * Create an insert query from a with data populated object based on the object given on creation of the QueryBuilder.
   * @param source The object with the decorators
   * @param onlyIncludeSourceProperties skip properties that are not present from the insert query.
   */
  public insert(source: any | any[], onlyIncludeSourceProperties = true) {
    this._queryType = "INSERT";

    if (!_.isArray(source)) {
      source = [source] as any[];
    }

    const factory = new Factory();
    const targetClass = factory.create(this._classObject);

    let properties: string[] = onlyIncludeSourceProperties ? Object.keys((source as any[]).find(x => x)) : Object.keys(targetClass as any);
    let columns = properties.map(p => getColumn(this._classObject, p));

    const valuesFragments: string[] = [];

    for (let s of
      source) {
      const values: string[] = [];

      for (const property of
        properties) {
        const value = parseValue(this._classObject, property, s[property]);
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
  public update(source: any, onlyIncludeSourceProperties = true) {
    this._queryType = "UPDATE";

    let sourceProperties: string[] = [];
    if (onlyIncludeSourceProperties) {
      sourceProperties = Object.keys(source);
    }
    const factory = new Factory();
    const targetClass = factory.create(this._classObject);

    const fragments: string[] = [];
    const properties = Object.keys(targetClass as any);

    for (const property of
      properties) {
      if (onlyIncludeSourceProperties && !sourceProperties.includes(property)) {
        continue;
      }

      const column = getColumn(this._classObject, property);
      const value = parseValue(this._classObject, property, source[property]);
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
  public where(group: WhereGroup, parentId: string | null = null) {
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
   * Generate the order by port of a query.
   * @param properties The properties of the class you wish to use to create the order by.
   * @param direction
   */
  public orderBy(properties: string | string[] | OrderByValue) {
    if (_.isArray(properties)) {
      const columns = properties.map(p => getColumn(this._classObject, p));
      this._orderByQueryString = `ORDER BY ${columns.join(', ')}`;
    } else if (typeof properties === 'object') {
      const cProperties = Object.keys(properties);
      this._orderByQueryString = `ORDER BY ${cProperties.map(prop => {
        const content = properties[prop];
        let classObject = this._classObject;
        if (!_.isNil(content.externalObject)) {
          classObject = content.externalObject;
        }
        return `${getColumn(classObject, prop)} ${content.direction}`
      })
        .join(', ')}`;
    } else {
      const column = [getColumn(this._classObject, properties as string)];
      this._orderByQueryString = `ORDER BY ${column}`;
    }

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
    for (let group of this._whereGroups) {
      const propertyFragments: string[] = [];
      for (const property of Object.keys(group.group)) {
        let content = group.group[property];

        if (typeof content !== "object" || content === null || content.constructor.name === 'DatabaseSystemValue') {
          content = {value: content};
        }

        let dbColumn = "";
        if (!_.isNil(content.externalObject)) {
          dbColumn = getColumn(content.externalObject, property);
        } else {
          dbColumn = getColumn(this._classObject, property);
        }

        if (_.isArray(content.value)) {
          if (_.isNil(content.type)) {
            content.type = WhereCompareType.IN;
          }

          switch (content.type) {
            case WhereCompareType.BETWEEN:
            case WhereCompareType.NOTBETWEEN: {
              propertyFragments.push(`${dbColumn} ${content.type} ${parseValue(this._classObject, property, content.value[0])} AND ${parseValue(this._classObject, property, content.value[1])}`);
              break;
            }
            case WhereCompareType.IN:
            case WhereCompareType.NOTIN: {
              propertyFragments.push(`${dbColumn} ${content.type} (${content.value.map((v: any) => parseValue(this._classObject, property, v))
                .join(", ")})`);
              break;
            }
          }
        } else {
          if (_.isNil(content.type)) {
            content.type = WhereCompareType.EQUAL;
          }

          const parsedValue = parseValue(this._classObject, property, content.value);
          if (parsedValue == "NULL" && content.type == WhereCompareType.EQUAL) {
            content.type = "IS";
          } else if (parsedValue == "NULL" && content.type == WhereCompareType.NOTEQUAL) {
            content.type = "IS NOT";
          }

          propertyFragments.push(`${dbColumn} ${content.type} ${parsedValue}`);
        }
      }
      this._whereRawGroups.push({
        parentId: group.parentId,
        query: propertyFragments.join(" AND ")
      });
    }


    const parentGroups: string[] = [];
    for (const parentId of _.uniq(this._whereRawGroups.map(f => f.parentId))) {
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
    let query = `SELECT ${this._selectQueryString ?? '*'}
                 FROM ${getTable(this._classObject)}`;

    query += `${this.convertWheregroupsToWhereString()}`;

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
    return `INSERT INTO ${getTable(this._classObject)} ${this._insertQueryString}`;
  }

  /**
   * Generate a delete query
   */
  private generateDeleteQuery() {
    let query = `DELETE
                 FROM ${getTable(this._classObject)}`;
    query += `${this.convertWheregroupsToWhereString()}`;
    return query;
  }

  /**
   * Generate a update query
   */
  private generateUpdateQuery() {
    let query = `UPDATE ${getTable(this._classObject)}
                 SET ${this._updateQueryString}`;
    query += `${this.convertWheregroupsToWhereString()}`;
    return query;
  }

  /**
   * Execute the builded query.
   */
  public async execute<T = any>(): Promise<T> {
    switch (this._queryType) {
      case 'SELECT': {
        const selectQuery = this.generateSelectQuery();
        const queryRes = await doQuery(selectQuery);
        const res = queryResultToObject<typeof this._classObject>(this._classObject, queryRes);
        if (this._single) {
          return res.find(x => x) as typeof this._classObject;
        } else {
          return res as typeof this._classObject[] as any;
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
export class SelectValue {
  public property!: string;
  public alias!: string;
}

/**
 * The value of buiilding a order query.
 */
export class OrderByValue {
  [property: string]: {
    direction?: OrderByDirection,
    externalObject?: any
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
export class WhereGroup {
  [key: string]: {
                   value: any | any[],
                   type?: WhereCompareType,
                   externalObject?: any,
                 } | any;
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