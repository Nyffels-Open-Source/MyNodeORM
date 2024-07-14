/**
 * All the possible types of a property used for parsing.
 */
export type propertyType = 'number' | 'boolean' | 'date'| 'datetime' | 'string';

/**
 * The wrapper element to declare a system value. ex: NOW()
 * We advise to use the MySQL enum for predefined values, but it is possible to freely enter a value in this wrapper. We advise developers to now use dynamic values provided by outside sources to prevent code injection.
 */
export class DatabaseSystemValue {
    value: any;

    constructor(mySQL: MySQL | string) {
        this.value = mySQL;
    }
}

/**
 * An enum with all the possible system values known to the package.
 */
export enum MySQL {
    NOW = "NOW()"
}