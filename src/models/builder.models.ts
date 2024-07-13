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
    private _orderByQuerySting: string | null = null;
    private _limitByQueryString: string | null = null;
    private _whereGroups: string[] = [];

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
        this._selectQueryString = columns.filter(c => c !== null).join(", ");
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
     * Create a insert query from a with data populated object based on the object given on creation of the queryBuilder.
     * @param source
     */
    public insert(source?: any) {
        this._queryType = "INSERT";

        const factory = new Factory();
        const targetClass = factory.create(this._classObject);

        const properties = Object.keys(targetClass as any);
        const columns: string[] = [];
        const values: string[] = [];

        properties.forEach(property => {
            const column = getColumn(this._classObject, property);
            const value = parseValue(this._classObject, property, source[property]);

            columns.push(column);
            values.push(value);
        });

        this._insertQueryString = `(${columns.join(', ')}) VALUES (${values.join(', ')})`;
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
    public where(group: WhereGroup) {
        let fragments: string[] = [];
        for (let property of Object.keys(group)) {
            const content = group[property];
            if (_.isArray(content.value)) {
                if (_.isNil(content.type)) {
                    content.type = WhereCompareType.IN;
                }

                if (![WhereCompareType.IN, WhereCompareType.BETWEEN, WhereCompareType.NOTIN, WhereCompareType.NOTBETWEEN].includes(content.type)) {
                    console.error("Incorrect usage of value and comparetype combination.");
                    continue;
                } else if ((content.value ?? []).length !== 2 && [WhereCompareType.BETWEEN, WhereCompareType.NOTBETWEEN].includes(content.type)) {
                    console.error("Between types requires an exact value array length of 2.");
                    continue;
                }

                switch (content.type) {
                    case WhereCompareType.BETWEEN:
                    case WhereCompareType.NOTBETWEEN: {
                        fragments.push(`${getColumn(this._classObject, property)} ${content.type} ${parseValue(this._classObject, property, content.value[0])} AND ${parseValue(this._classObject, property, content.value[1])}`)
                        break;
                    }
                    case WhereCompareType.IN:
                    case WhereCompareType.NOTIN: {
                        fragments.push(`${getColumn(this._classObject, property)} ${content.type} (${content.value.map(v => parseValue(this._classObject, property, v)).join(", ")})`);
                        break;
                    }
                }
            } else {
                if (_.isNil(content.type)) {
                    content.type = WhereCompareType.EQUAL;
                }

                const propertyType = getType(this._classObject, property);
                if (![WhereCompareType.LESSEQUAL, WhereCompareType.LESS, WhereCompareType.LIKE, WhereCompareType.NOTLIKE, WhereCompareType.EQUAL, WhereCompareType.GREATEREQUAL].includes(content.type)) {
                    console.error("Incorrect usage of value and comparetype combination.");
                    continue;
                } else if (propertyType !== "string" && [WhereCompareType.LIKE || WhereCompareType.NOTLIKE].includes(content.type)) {
                    console.error("String compare is used on a non string value.");
                    continue;
                }

                fragments.push(`${getColumn(this._classObject, property)} ${content.type} ${parseValue(this._classObject, property, content.value)}`);
            }
        }

        this._whereGroups.push(fragments.join(" AND "));
        return this;
    }

    /**
     * Give a raw query that will be pasted in the where group and be combined with the other where's with the OR element.
     * @param whereQuery
     */
    public whereRaw(whereQuery: string) {
        this._whereGroups.push(whereQuery);
    }

    /**
     * Generate the order by port of a query.
     * @param properties The properties of the class you wish to use to create the order by.
     * @param direction
     */
    public orderBy(properties: string | string[], direction: OrderByDirection = OrderByDirection.ASC) {
        let columns = [];
        if (_.isArray(properties)) {
            columns = properties.map(p => getColumn(this._classObject, p));
        } else {
            columns = [getColumn(this._classObject, properties)];
        }
        this._orderByQuerySting = `ORDER BY ${columns.join(', ')} ${direction}`;

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

    /**
     * Generate a select query.
     */
    public generateSelectQuery() {
        let query = `SELECT ${this._selectQueryString ?? '*'}
                     FROM ${getTable(this._classObject)}`;

        this._whereGroups = this._whereGroups.filter(g => !_.isNil(g) && g.trim().length > 0);
        if ((this._whereGroups ?? []).length > 0) {
            if (this._whereGroups.length === 1) {
                query += ` WHERE ${this._whereGroups.find(x => x)}`;
            } else {
                query += ` WHERE ${this._whereGroups.map(group => "(" + group + ")").join(" OR ")}`;
            }
        }

        if (this._orderByQuerySting !== null) {
            query += ' ' + this._orderByQuerySting;
        }

        if (this._limitByQueryString !== null) {
            query += ' ' + this._limitByQueryString;
        }

        return query;
    }

    /**
     * Generate a insert query.
     */
    public generateInsertQuery() {
        return `INSERT INTO ${getTable(this._classObject)} ${this._insertQueryString}`;
    }

    /**
     * Generate a delete query
     */
    public generateDeleteQuery() {
        let query = `DELETE FROM ${getTable(this._classObject)}`;
        this._whereGroups = this._whereGroups.filter(g => !_.isNil(g) && g.trim().length > 0);
        if ((this._whereGroups ?? []).length > 0) {
            if (this._whereGroups.length === 1) {
                query += ` WHERE ${this._whereGroups.find(x => x)}`;
            } else {
                query += ` WHERE ${this._whereGroups.map(group => "(" + group + ")").join(" OR ")}`;
            }
        }
        return query;
    }

    /**
     * Execute the builded query.
     */
    public async execute() {
        switch (this._queryType) {
            case 'SELECT': {
                const selectQuery = this.generateSelectQuery();
                const queryRes = await doQuery(selectQuery);
                const res = queryResultToObject<typeof this._classObject>(this._classObject, queryRes);
                if (this._single) {
                    return res.find(x => x) as typeof this._classObject;
                } else {
                    return res as typeof this._classObject[];
                }
            }
            case 'UPDATE': {
                // TODO
                throw new Error("Not yet available");
                break;
            }
            case 'DELETE': {
                const deleteQuery = this.generateDeleteQuery();
                return await doMutation(deleteQuery);
            }
            case "INSERT": {
                const insertQuery = this.generateInsertQuery();
                return await doMutation(insertQuery);
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
    }
}

/**
 * Compare types for a where value.
 */
export enum WhereCompareType {
    EQUAL = "=", // This is the default for single string values
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