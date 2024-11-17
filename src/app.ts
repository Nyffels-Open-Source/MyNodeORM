import path from "path";
import fs from 'fs';
import _ from "lodash";

const args = process.argv.slice(2);

if (args.includes("--create-config")) {
  const fileLocationRaw = args.find(a => a.includes('--location='));
  const fileLocation = fileLocationRaw ? fileLocationRaw.replace("--location=", "") : "./";
  const fullPath = fileLocation.startsWith(".") ? path.join(process.cwd(), fileLocation) : fileLocation;

  const host = args.find((a) => a.includes('--host='))
    ?.replace('--host=', '');
  const port = args.find((a) => a.includes('--port='))
    ?.replace('--port=', '');
  const user = args.find((a) => a.includes('--user='))
    ?.replace('--user=', '');
  const password = args.find((a) => a.includes('--password='))
    ?.replace('--password=', '');
  const database = args.find((a) => a.includes('--database='))
    ?.replace('--database=', '');

  const fullPathWithFile = path.join(fullPath, "mynodeorm-config.json");
  if (fs.existsSync(fullPathWithFile)) {
    fs.unlinkSync(fullPathWithFile);
  }

  const config = {
    mysql: {
      host: host,
      port: port,
      user: user,
      password: password,
      database: database
    }
  }
  fs.writeFileSync(fullPathWithFile, JSON.stringify(config), {encoding: "utf8"});
} else if (args.includes("--create-migration-script")) {
  const fileLocationRaw = args.find(a => a.includes('--location='));
  const fileLocation = fileLocationRaw ? fileLocationRaw.replace("--location=", "") : "./";
  const fullPath = fileLocation.startsWith(".") ? path.join(process.cwd(), fileLocation) : fileLocation;

  const fullPathWithFile = path.join(fullPath, "mynodeorm-migration.ts");
  if (fs.existsSync(fullPathWithFile)) {
    fs.unlinkSync(fullPathWithFile);
  }
  
  const script =  ``; // TODO
  fs.writeFileSync(fullPathWithFile, script, {encoding: "utf8"});
} else if (args.includes("--migration")) {
  const migrationName = args.find(a => a.includes("--name="))
    ?.replace("--name=", "");
  if (_.isNil(migrationName)) {
    throw Error("Migration requires a name");
  }

  // TODO
}