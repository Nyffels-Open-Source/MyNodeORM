import {MigrationBuilder} from '@nyffels/mynodeorm';

export class MigrationFile {
    public _builder = new MigrationBuilder();
    
    public up() {
        /*
            You can add custom data here to be run before the migration plan.
        */
    
        const table_0 = this._builder.addTable('test_par_sis');
        table_0.addColumn('test_par_sis_id', 'INT(255)').primary().unique().autoIncrement();

        this._builder.execute();
        
        /*
            You can add custom data here to be run after the migration plan.
        */
    }
        
    public down() {
        /*
            You can add custom data here to be run before the migration plan.
        */
        
        this._builder.dropTable('test_par_sis')

        this._builder.execute();
        
        /*
            You can add custom data here to be run after the migration plan.
        */        
    }
}