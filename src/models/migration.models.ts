import {ForeignKeyOption} from "../decorators/index.js";

export abstract class MigrationFileBuilder {
    public static GetFileTemplate() {
        return `import {MigrationBuilder} from '@nyffels/mynodeorm';

export class MigrationFile {
    private _builder = new MigrationBuilder();
    private _version = {{{{VERSION}}}}
    
    public async migrate() {
        /*
            You can add custom data here to be run before the migration plan.
        */
    
{{{{TEMPLATE-DATA}}}}
        
        /*
            You can add custom data here to be run after the migration plan.
        */
        
        this._builder.execute(_version);
    }
}`;
    }
}

export class MigrationBuilder {
    private _queries: string[] = [];
    
    public addQuery(query: string) {
        this._queries.push(query);
    }
    
    public execute(version: string) {
        // TODO

        // if version === 0:
        // scriptLines.push(`DROP TABLE IF EXISTS __myNodeORM;`)
        // scriptLines.push(`CREATE TABLE __myNodeORM (version INT NOT NULL, DATE DATETIME NOT NULL DEFAULT NOW());`);
        // scriptLines.push(`INSERT INTO __myNodeORM (version) VALUES (${(latestMigrationVersion ?? "").split(".").find(x => x)});`);
        // else
        // scriptLines.push(`INSERT INTO __myNodeORM (version) VALUES (${(latestMigrationVersion ?? "").split(".").find(x => x)});`);
    }
}