import {endConnection, getConnection, setConnection} from "../logic/index.js";

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
        
        await this._builder.execute(this._version);
    }
}`;
    }
}

export class MigrationBuilder {
    private _queries: string[] = [];
    
    public addQuery(query: string) {
        this._queries.push(query);
    }
    
    public async execute(version: number) {
        await setConnection();
        const connection = getConnection();

        const [rows, fields] = await connection.query('SELECT locked FROM __myNodeORM LIMIT 1');
        if ((rows as any[]).length > 0 && (rows as any[])[0].locked === 1) {
            console.log(`X  Migration table locked. Execution has been skipped.`);
            return;
        }
        await connection.execute('UPDATE __myNodeORM SET locked = 1');
        
        await connection.beginTransaction();

        try {
            for (let query of this._queries) {
                await connection.execute(query);
            }

            if (version === 0) {
                await connection.execute("DROP TABLE IF EXISTS __myNodeORM;");
                await connection.execute("CREATE TABLE __myNodeORM (version INT NOT NULL, date DATETIME NOT NULL DEFAULT NOW(), locked TINYINT NOT NULL DEFAULT 0);");
                await connection.execute(`INSERT INTO __myNodeORM (version) VALUES (${version});`);
            } else {
                await connection.execute(`INSERT INTO __myNodeORM (version) VALUES (${version});`);
            }

            await connection.commit();
            console.log(`✅  Migration ${version} executed successfully.`);
        } catch {
            await connection.rollback();
            console.log("X  Migration execution failed.");
        }
        
        await endConnection();
        await connection.execute('UPDATE __myNodeORM SET locked = 0');
    }
}