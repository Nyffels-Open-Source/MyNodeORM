import mysql from "mysql2/promise";

/**
 * All the possible types of a property used for parsing.
 */
export type propertyType = 'number' | 'boolean' | 'date'| 'datetime' | 'string';

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

    constructor(mySQL: MySQL | string) {
        if (mySQL === MySQL.RAW) {
            this.isRaw = true;
        }

        this._value = mySQL;
    }

    public static Raw(rawQuery: string) {
        const dbSystemValue = new DatabaseSystemValue(MySQL.RAW);
        dbSystemValue.value
    }
}

/**
 * An enum with all the possible system values known to the package.
 */
export enum MySQL {
    NOW = "NOW()",
    RAW = "THIS IS A RAW VALUE"
}