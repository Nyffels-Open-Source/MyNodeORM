import {column, foreignKey, ForeignKeyOption, primary, required, table, type, unique, unsigned} from "../decorators";
import {Test1} from "./class-parent";

@table("test_par_child")
export class TestChild {
  @column("test_par_child_guid")
  @primary()
  @unique()
  @required()
  @type("guid")
  public guid: string = "";

  @column("test_par_child_test_par_guid")
  @type("guid")
  @foreignKey<Test1>(Test1, "guid", ForeignKeyOption.Cascade, ForeignKeyOption.SetNull)
  public parentGuid: string = "";

  @column("test_par_child_rd")
  @type('bigstring')
  public rawData: string = "";

  @column("test_par_child_money")
  @type('number', "10.2")
  public money: number = 0;

  @column("test_par_child_microid")
  @type("number", "10")
  public mId: number = 0;
}