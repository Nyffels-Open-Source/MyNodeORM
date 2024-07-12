import _ from 'lodash';

/**
 * Parse a string value to a MySql safe value
 * @param value the string  you wish to parse
 * @returns MySql safe parsed string
 */
export function parseString(value: string): string {
    return value != null && value.toString().trim().length > 0 ? `'${value.toString().replace(/'/g, "''")}'` : 'NULL';
}

/**
 * Parse a number value to a MySql safe value
 * @param value the number you wish to parse
 * @returns MySql safe parsed number as a string
 */
export function parseNumber(value: number): string {
    return value != null ? '' + value : 'NULL';
}

/**
 * Parse a boolean value to a MySql safe value
 * @param value the boolean you wish to parse
 * @param canBeNull Enable if the value can be NULL
 * @returns MySql safe parsed boolean as a string
 */
export function parseBoolean(value: boolean, canBeNull = false): string {
    return _.isNil(value) ? (canBeNull ? 'NULL' : '0') : value ? '1' : '0';
}

/**
 * Parse a date value to a MySql safe value
 * @param date the date you wish to parse
 * @param time Enable if you wish to add the time to the parsed value
 * @returns MySql safe parsed date / datetime as a string
 */
export function parseDate(date: Date, time = false): string {
    if (date == null) return 'NULL';
    return time ? `'${new Date(date).toISOString().slice(0, 19).replace('T', ' ')}'` : `'${new Date(date).toISOString().slice(0, 10)}'`;
}
