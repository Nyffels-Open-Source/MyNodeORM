export abstract class MigrationFileBuilder {
    public static GetFileTemplate() {
        return `import {MigrationBuilder} from '@nyffels/mynodeorm';

export class MigrationFile {
    public _builder = new MigrationBuilder();
    
    public async up() {
        /*
            You can add custom data here to be run before the migration plan.
        */
    
        {{{{TEMPLATE-DATA-UP}}}}
        
        /*
            You can add custom data here to be run after the migration plan.
        */
    }
        
    public async down() {
        /*
            You can add custom data here to be run before the migration plan.
        */
        
        {{{{TEMPLATE-DATA-DOWN}}}}
        
        /*
            You can add custom data here to be run after the migration plan.
        */        
    }
}`;
    }
}

export class MigrationBuilder {
    private _queries: string[] = [];

    constructor() {
    }

    public addTable(name: string) {
        return new MigrationTable(name, {action: "create"}, this);
    }

    public alterTable(name: string) {
        return new MigrationTable(name, {action: "alter"}, this);
    }

    public dropTable(name: string) {
        const table = new MigrationTable(name, {action: "drop"}, this);
    }

    public addQuery(query: string) {
        this._queries.push(query);
    }

    public execute() {
        // TODO execute all queries one by inside a transaction.
        console.log(this._queries);
        return;
    }
}

export class MigrationTable {
    private _name!: string;
    private _columns: MigrationColumn[] = [];
    private _options!: MigrationTableOptions;
    private _parent!: MigrationBuilder;

    constructor(name: string, options: MigrationTableOptions, parent: MigrationBuilder) {
        this._name = name;
        this._options = options;
    }

    public commit() {
        switch (this._options.action) {
            case "create":
                let createQuery = `CREATE TABLE \`${this._name}\` (`;
                // TODO
                /*
                CREATE TABLE `doffice`.`test` (
                  `test1` VARCHAR(36) NOT NULL,
                  `test2` INT NOT NULL AUTO_INCREMENT,
                  `test3` DATETIME NULL,
                  PRIMARY KEY (`test1`),
                  UNIQUE INDEX `test1_UNIQUE` (`test1` ASC) VISIBLE);
                 */

                for (const column of this._columns) {
                    const values = column.getValues();
                    let columnsSql = `\`${values.name}\` ${values.type}`;
                    columnsSql += values.nullable ? ` NULL` : ` NOT NULL`;
                    if ((values.defaultSql ?? '').length > 0) {
                        columnsSql += ` DEFAULT ${values.defaultSql}`;
                    }
                }
                createQuery += `);`
                this._parent.addQuery(createQuery);
                break;
            case "alter":
                let alterQuery = `ALTER TABLE ${this._name}`;
                // TODO
                alterQuery += ';';
                break;
            case "drop":
                this._parent.addQuery(`DROP TABLE ${this._name};`);
                break;
        }
    }

    public addColumn(name: string, sqlType: string) {
        const column = new MigrationColumn(name, sqlType, {action: "create"});
        this._columns.push(column);
        return column;
    }

    public dropColumn(name: string) {
        if (this._options.action != 'alter') {
            throw new Error("Drop column is only available in combination with tableOption action equals to 'alter'.");
        }
        const column = new MigrationColumn(name, "N/A", {action: "drop"});
        this._columns.push(column);
    }

    public alterColumn(name: string) {
        if (this._options.action != 'alter') {
            throw new Error("Alter column is only available in combination with tableOption action equals to 'alter'.");
        }

        // TODO
    }
}

export interface MigrationTableOptions {
    action: 'create' | 'alter' | 'drop'
}

export class MigrationColumn {
    private _name!: string;
    private _type!: string;
    private _options!: MigrationColumnOptions

    private _primary: boolean = false;
    private _nullable: boolean = false;
    private _unique: boolean = false;
    private _unsigned: boolean = false;
    private _autoIncrement: boolean = false;
    private _defaultSql: string | null = null;

    constructor(name: string, type: string, options: MigrationColumnOptions) {
        this._name = name;
        this._type = type;
        this._options = options;
    }

    public primary() {
        this._primary = true;
        return this;
    }

    public nullable() {
        this._nullable = true;
        return this;
    }

    public unique() {
        this._unique = true;
        return this;
    }

    public unsigned() {
        this._unsigned = true;
        return this;
    }

    public autoIncrement() {
        this._autoIncrement = true;
        return this;
    }

    public defaultSql(sql: string) {
        this._defaultSql = sql;
        return this;
    };

    public getValues() {
        return {
            name: this._name,
            type: this._type,
            primary: this._primary,
            nullable: this._nullable,
            unique: this._unique,
            unsigned: this._unsigned,
            autoIncrement: this._autoIncrement,
            defaultSql: this._defaultSql,
        }
    }
}

export interface MigrationColumnOptions {
    action: 'create' | 'alter' | 'drop'
}