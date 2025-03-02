import {ForeignKeyOption} from "./declaration.model.js";

export interface DatabaseSchema {
  [table: string]: {
    columns: DatabaseSchemaColumn
  }
}

export interface DatabaseSchemaColumn {
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