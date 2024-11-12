# MyNodeORM
A full-fledged ORM framework for NodeJS and MySQL with develop friendly code aimed to handle database migrations, MySQL Query builder / helper and property mapping.

## Installation 
Use the npm package manager to install "MySQL Query Builder" by running the command

<code> npm install @nyffels/mynodeorm </code>

## Usage

### Map a class to a MySQL table
You need to map your class to a MySQL table and columns to use them in the QueryBuilder function. A mapping happens partial on class level and partial on property level. \

#### Class decorators
The @id decorator will allow the developer to fetch the class by it's id.\
**Key**: _string_: This parameter is the ID used to link the string to a class \
**Class**: _object_: this Object is the class itself declared under this decorator \
<code>@id(Key, Class)</code>

The @table decorator contains the name of the table that is linked to this class.\
**mySqlTableName**: _string_: This includes the MySQL table name linked to this class and will be used in the QueryBuilder \
<code>@table(mySqlTableName)</code>

#### Property decorators
The @column decorator contains the name of the column that is linked to this property.\
**mySqlColumnName**: _string_: This includes the MySQL column name linked to this property and will be used in the QueryBuidler \
<code>@column(mySqlColumnName)</code>

The @type decorator contains the type of the column. If @type is missing of invalid the type will default to a string. \
**propertyType**: _number | boolean | date | datetime | string_: The decorator contains information about the column type. For all the non-string values it is best practice to declare the types to be 100% certain on SQL generation.
@type(propertyType)

Example:
<pre>
<code>
@id("exWork", WorkClass)\
@table("Ex_work")\
export class WorkClass {
&nbsp&nbsp @column("workStart")
&nbsp&nbsp @type("datetime")
&nbsp&nbsp start: Date;

&nbsp&nbsp @column("workEnd")
&nbsp&nbsp @type("datetime")
&nbsp&nbsp end: Date;

&nbsp&nbsp constructor() {}
}
</code>
</pre>

### Query Builder 
TODO documentation

### Standalone functions

#### MySQL Connections
<code>setConnection()</code> \
TODO documentation

<code>getConnection(skipNoConnectionError = true)</code> \
TODO documentation

<code>endConnection()</code> \
TODO documentation

#### Query handling

<code>doMutation(sqlQuery: string, options: QueryOptions | null = null)</code> \
TODO documentation

<code>doQuery<T = any>(sqlQuery: string, options: QueryOptions | null = null)</code> \
TODO documentation

<code>queryResultToObject<T = any>(classObject: Object, results: any[])</code> \
TODO documentation

#### Value parsers

<code>parseString(value: string)</code> \
TODO documentation

<code>parseNumber(value: number)</code> \
TODO documentation

<code>parseBoolean(value: boolean, canBeNull = false)</code> \
TODO documentation

<code>parseDate(date: Date, time = false)</code> \
TODO documentation

<code>parseValue(sourceClass: any, property: string, value: any)</code> \
TODO documentation

### Database Migration 
Currently not available in the framework. This function will be released in a newer version. 

## Progress 
- [X] Property mapping
- [X] Query helpers 
- [X] Query builders
- [ ] Database migration tool

## Contributing
Pull requests are welcome but open an issue first to discuss what you would like to change.\
For major changes, please open an issue first to discuss what you would like to change.

## License 
MIT -  Copyright (c) 2023-2024 Nyffels BV

## Links 
github (https://github.com/Nyffels-Open-Source/mysql-query-builder) \
npmjs (https://www.npmjs.com/package/@nyffels/mysql-query-builder)

## Dependencies
- NodeJS
- MySQL2 (https://www.npmjs.com/package/mysql2)
- Lodash (https://www.npmjs.com/package/lodash)

## Release notes
Currently in Alpha development with possible breaking changes. Use this software at your own risk. Nyffels doesn't provide Release notes or changelogs at this stage of development. 
