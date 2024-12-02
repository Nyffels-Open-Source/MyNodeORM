import {column, foreignKey, ForeignKeyOption, nullable, primary, table, unique, unsigned} from "../decorators";
import {Test1} from "./class-parent";

@table("test_par_child")
export class TestChild {
  @column("test_par_child_guid")
  @primary()
  @unique()
  @nullable(false)
  @unsigned()
  public guid: string = "";

  @column("test_par_child_test_par_guid")
  @foreignKey<Test1>(Test1, "guid", ForeignKeyOption.Cascade, ForeignKeyOption.SetNull)
  public parentGuid: string = "";
}