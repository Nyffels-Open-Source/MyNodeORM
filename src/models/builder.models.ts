import {getColumn, getTable} from "../decorators";
import _ from "lodash";

export class QueryBuilder {
    private _classObject: any;

    private _selectQueryString: string = "*";
    private _orderByQuerySting: string | null = null;
    private _limitByQueryString: string | null = null;

    /**
     * Create a querybuilder for easy and fast quey building based on the decoration methode for links between class properties and database columns
     * @param classObject The object with the decorators
     */
    constructor(classObject: any) {
        this._classObject = classObject;
    }

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
        return this;
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
     * @param limit The limit of the rows you wisch to fetch
     * @param offset The offset of rows you wish to skip
     */
    public limit(limit: number, offset: number | null = null) {
        this._limitByQueryString = `LIMIT ${limit}`;
        if (offset !== null) {
            this._limitByQueryString += ` OFFSET ${offset}`;
        }

        return this;
    }

    /* Output elements */
    /**
     * Generate a select query.
     */
    public generateSelectQuery(): string {
        let query = `SELECT ${this._selectQueryString ?? '*'} FROM ${getTable(this._classObject)}`;
        if (this._limitByQueryString !== null) {
            query += ' ' + this._limitByQueryString;
        }
        if (this._orderByQuerySting !== null) {
            query += ' ' + this._orderByQuerySting;
        }
        return query;
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
 * Convert a query result to an object.
 * @param sourceClass The class with MySQL decorations for mappping.
 * @param results The query results received from the MySQL query.
 * @returns A generated object from the sourceClass value.
 */
export function queryResultToObject<T = any>(sourceClass: any, results: any[]) {
    const properties = Object.getOwnPropertyNames(sourceClass);
    const result: any[] = [];

    (results ?? []).forEach((res) => {
        const resultObject = {} as any;
        properties.forEach((prop) => {
            const columnname = getColumn(sourceClass, prop);
            if (columnname) {
                resultObject[prop] = res[columnname];
            }
        });
        result.push(resultObject);
    });

    return (result as T[]);
}