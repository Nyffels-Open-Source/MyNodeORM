import {column, nullable, primary, table, unique, unsigned} from "../decorators";

@table("test_par")
export class Test1 {
  @column("test_par_guid")
  @primary()
  @unique()
  @nullable(false)
  @unsigned()
  public guid: string = "";

  @column("test_par_name")
  public name: string = "";
}