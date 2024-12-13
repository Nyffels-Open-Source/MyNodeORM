export abstract class MigrationFileBuilder {
    public static GetFileTemplate() {
        return `import {MigrationBuilder} from '@nyffels/mynodeorm';

export class MigrationFile {
    public _builder = new MigrationBuilder();
    
    public up() {
        /*
            You can add custom data here to be run before the migration plan.
        */
    
        {{{{TEMPLATE-DATA-UP}}}}
        
        /*
            You can add custom data here to be run after the migration plan.
        */
    }
        
    public down() {
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
    private _tables: MigrationTable[] = [];
    
    constructor () {}
    
    public addTable(name: string) {
        const table = new MigrationTable(name);
        this._tables.push(table);
        return table;
    }
    
    public dropTable(name: string) {
        // TODO
        return;
    }
    
    public doRawQuery(query: string) {
        // TODO
        return;
    }
    
    public execute() {
        // TODO
        return;
    }
}

export class MigrationTable {
    private _name!: string; 
    private _columns: MigrationColumn[] = [];
    
    constructor(name: string) {
        this._name = name;
    }
    
    public addColumn(name: string, sqlType: string) {
        const column = new MigrationColumn(name, sqlType);
        this._columns.push(column);
        return column;
    }
}

export class MigrationColumn {
    private _name!: string;
    private _type!: string;
    
    private _primary: boolean = false;
    private _nullable: boolean = false;
    private _unique: boolean = false;
    private _unsigned: boolean = false;
    private _autoIncrement: boolean = false;
    private _defaultSql: string | null = null;
    
    constructor(name: string, type: string) {
        this._name = name; 
        this._type = type;
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
    
    public autoincrement() {
        this._autoIncrement = true;
        return this;
    }
    
    public defaultSql(sql: string) {
        this._defaultSql = sql;
        return this;
    };
}