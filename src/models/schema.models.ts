import {ForeignKeyOption} from "../decorators/index.js";

export interface Schema {
  [table: string]: {
    columns: SchemaColumn
  }
}

export interface SchemaColumn {
  [column: string]: {
    type: string;
    primary: boolean;
    nullable: boolean;
    unique: boolean;
    unsigned: boolean;
    autoIncrement: boolean;
    defaultSql: string | null;
    foreignKey: {
                  table: string;
                  column: string;
                  onDelete: ForeignKeyOption;
                  onUpdate: ForeignKeyOption;
                } | null;
  }
}