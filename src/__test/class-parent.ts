import {column, defaultSql, required, primary, table, type, unique, unsigned} from "../decorators/index.js";
import {MySQLValue} from "../models/index.js";

@table("test_par")
export class Test1 {
  @column("test_par_guid")
  @primary()
  @unique()
  @required()
  @type("guid")
  public guid: string = "";

  @column("test_par_name")
  public name: string = "";

  @column("test_par_date")
  @type("date")
  public date: Date = new Date();

  @column("test_par_child_guid")
  @type("datetime")
  @defaultSql(MySQLValue.now)
  public created: Date = new Date();
}