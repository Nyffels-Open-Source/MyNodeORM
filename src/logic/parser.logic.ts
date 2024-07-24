import _ from 'lodash';
import {getType} from "../decorators";

/**
 * Parse a string value to a MySQL safe value
 * @param value the string  you wish to parse
 * @returns MySql safe parsed string
 */
export function parseString(value: string): string {
    return value != null && value.toString().trim().length > 0 ? `'${value.toString().replace(/'/g, "''")}'` : 'NULL';
}

/**
 * Parse a number value to a MySQL safe value
 * @param value the number you wish to parse
 * @returns MySql safe parsed number as a string
 */
export function parseNumber(value: number): string {
    return value != null ? '' + value : 'NULL';
}

/**
 * Parse a boolean value to a MySQL safe value
 * @param value the boolean you wish to parse
 * @param canBeNull Enable if the value can be NULL
 * @returns MySql safe parsed boolean as a string
 */
export function parseBoolean(value: boolean, canBeNull = false): string {
    return _.isNil(value) ? (canBeNull ? 'NULL' : '0') : value ? '1' : '0';
}

/**
 * Parse a date value to a MySQL safe value
 * @param date the date you wish to parse
 * @param time Enable if you wish to add the time to the parsed value
 * @returns MySql safe parsed date / datetime as a string
 */
export function parseDate(date: Date, time = false): string {
    if (date == null) return 'NULL';
    return time ? `'${new Date(date).toISOString().slice(0, 19).replace('T', ' ')}'` : `'${new Date(date).toISOString().slice(0, 10)}'`;
}

/**
 * Parse an unknown type of value to a MySQL safe value.
 * @param sourceClass The class with the mapping decorations you wish to use
 * @param property The property of the class you wish to parse
 * @param value The value itself you wish to parse
 */
export function parseValue(sourceClass: any, property: string, value: any) {
    if (typeof value === 'object' && value !== null && value.constructor.name === 'DatabaseSystemValue') {
        return value.value;
    }

    switch (getType(sourceClass, property)) {
        case 'number':
            return parseNumber(value);
        case 'boolean':
            return parseBoolean(value);
        case 'date':
            return parseDate(value, false);
        case 'datetime':
            return parseDate(value, true);
        default:
            return parseString(value);
    }
}