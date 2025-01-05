import {column, defaultSql, required, primary, table, type, unique, unsigned, autoIncrement} from "../decorators/index.js";

@table("test_par_sis")
export class TestSister {
  @column("test_par_sis_id")
  @primary()
  @unique()
  @required()
  @autoIncrement()
  @type("number")
  public id: number = 0;
}