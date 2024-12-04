import mysql from "mysql2/promise";

/**
 * All the possible types of a property used for parsing.
 */
export type propertyType = 'number' | 'bignumber' | 'boolean' | 'date'| 'time' | 'datetime' | 'string' | 'bigstring' | 'guid';

/**
 * The wrapper element to declare a system value. ex: NOW()
 * We advise to use the MySQL enum for predefined values, but it is possible to freely enter a value in this wrapper. We advise developers to now use dynamic values provided by outside sources to prevent code injection.
 */
export class DatabaseSystemValue {
    private isRaw;
    private _value: any;
    get value() {
        return this._value;
    }
    set value(rawQuery: string) {
        if (!this.isRaw) {
            throw new Error("Can't update a non-raw DatabaseSystemValue with a raw query.");
        }

        this._value = rawQuery;
    }

    constructor(mySQL: MySQLValue | string) {
        if (mySQL === MySQLValue.DeclareRaw) {
            this.isRaw = true;
        }

        this._value = mySQL;
    }

    public static Raw(rawQuery: string) {
        const dbSystemValue = new DatabaseSystemValue(MySQLValue.DeclareRaw);
        dbSystemValue.value = rawQuery;
        return dbSystemValue;
    }
}

export abstract class MySQLValue {
    static get DeclareRaw() {
        return "THIS IS A RAW SQL VALUE";
    }

    static get now() {
        return "NOW()";
    }
}