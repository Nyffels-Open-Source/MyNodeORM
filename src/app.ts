import path from "path";
import fs from 'fs';

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
  
  const config = {
    mysql: {
      host: host,
      port: port,
      user: user,
      password: password,
      database: database
    }
  }
  fs.writeFileSync(path.join(fullPath, "mynodeorm-config.json"), JSON.stringify(config), {encoding: "utf8"});
} 