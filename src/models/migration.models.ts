import {endConnection, getConnection, setConnection} from "../logic/index.js";

export abstract class MigrationFileBuilder {
  public static GetFileTemplate() {
    return `import {MigrationBuilder} from '@nyffels/mynodeorm';

export class MigrationFile {
    private _builder = new MigrationBuilder();
    private _version = "{{{{VERSION}}}}";
    
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

  public async execute(version: string) {
    await setConnection();
    const connection = getConnection();

    await connection.beginTransaction();

    for (let query of this._queries) {
      await connection.execute(query);
    }

    try {
      const [countRows]: any = await connection.query("SELECT COUNT(*) as count FROM information_schema.TABLES WHERE TABLE_NAME = '__myNodeORM';");
      const count = countRows[0].count;
      
      if (count <= 0) {
        await connection.execute("CREATE TABLE __myNodeORM (version VARCHAR(255) NOT NULL, date DATETIME NOT NULL DEFAULT NOW());");
      }

      await connection.execute(`INSERT INTO __myNodeORM (version) VALUES (${version});`);

      await connection.commit();
      console.log(`✅  Migration ${version} executed successfully.`);
    } catch (err) {
      await connection.rollback();
      console.log("❌  Migration execution failed. Error: " + err);
    }

    await endConnection();
  }
}