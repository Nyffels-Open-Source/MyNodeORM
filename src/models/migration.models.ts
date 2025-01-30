import {ForeignKeyOption} from "../decorators/index.js";

export abstract class MigrationFileBuilder {
    public static GetFileTemplate() {
        return `import {MigrationBuilder} from '@nyffels/mynodeorm';

export class MigrationFile {
    private _builder = new MigrationBuilder();
    
    public async up() {
        /*
            You can add custom data here to be run before the migration plan.
        */
    
        {{{{TEMPLATE-DATA-UP}}}}
        
        /*
            You can add custom data here to be run after the migration plan.
        */
        
        _builder.execute();
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
    
    public addQuery(query: string) {
        this._queries.push(query);
    }
    
    public execute() {
        // TODO
    }
}