import {MigrationBuilder} from "../../models";

export class MigrationFile {
    public _builder = new MigrationBuilder();
    
    public up() {
        /*
            You can add custom data here to be run before the migration plan.
        */
    
        const table_0 = this._builder.addTable('test_par');
        table_0.addColumn('test_par_guid', 'VARCHAR(36)').primary().unique();
        table_0.addColumn('test_par_name', 'VARCHAR(255)').nullable();
        table_0.addColumn('test_par_date', 'DATE').nullable();
        table_0.addColumn('test_par_child_guid', 'DATETIME').nullable().defaultSql('NOW()');

        const table_1 = this._builder.addTable('test_par_child');
        table_1.addColumn('test_par_child_guid', 'VARCHAR(36)').primary().unique();
        table_1.addColumn('test_par_child_test_par_guid', 'VARCHAR(36)').nullable();
        table_1.addColumn('test_par_child_rd', 'LONGTEXT').nullable();
        table_1.addColumn('test_par_child_money', 'DECIMAL(10, 2)').nullable();
        table_1.addColumn('test_par_child_microid', 'INT(10)').nullable();

        this._builder.execute();
        
        /*
            You can add custom data here to be run after the migration plan.
        */
    }
        
    public down() {
        /*
            You can add custom data here to be run before the migration plan.
        */
        
        // First migration plan starts from empty database, down should mean destroy database. Database not empty? Use rebase function for integration of existing database to the migration flow.
        
        /*
            You can add custom data here to be run after the migration plan.
        */        
    }
}