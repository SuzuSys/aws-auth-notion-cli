import { openSync, readFileSync, appendFileSync } from "node:fs";
import { prompt } from "enquirer";

export const setToken = async () => {
  let response: {
    token: string;
  };
  try {
    response = await prompt({
      type: "input",
      name: "token",
      message: "What is your Notion token?",
    });
  } catch {
    process.exit(1);
  }
  const { token } = response;
  let inputStr = "NOTION_TOKEN=" + token + "\n";

  const file = openSync(".env", "a+");
  const content = readFileSync(file, { encoding: "utf-8" });
  if (!/(?:\n$)|(?:^$)/m.test(content)) {
    inputStr = "\n" + inputStr;
  }
  appendFileSync(".env", inputStr);
  return token;
};

export const setDatabaseID = async () => {
  let response: {
    databaseUrl: string;
  };
  try {
    response = await prompt({
      type: "input",
      name: "databaseUrl",
      message:
        "What is a new database id or url? (The entered url will be automatically converted to an id.)\n",
    });
  } catch {
    process.exit(1);
  }

  let id: string;
  if (
    /^[A-Za-z0-9]{8}-(?:[A-Za-z0-9]{4}-){3}[A-Za-z0-9]{12}$/.test(
      response.databaseUrl
    )
  ) {
    id = response.databaseUrl;
  } else {
    let preId: string;
    if (/^[A-Za-z0-9]{32}$/.test(response.databaseUrl)) {
      preId = response.databaseUrl;
    } else {
      const matched = response.databaseUrl.match(/[A-Za-z0-9]{32}(?=\?)/g);
      if (matched) {
        preId = matched[0];
      } else {
        console.error("Invalid ID or URL.");
        process.exit(1);
      }
    }
    let preIdArr: Array<string> = [];
    let idxStart = 0;
    [8, 4, 4, 4, 12].forEach((e) => {
      preIdArr.push(preId.slice(idxStart, idxStart + e));
      idxStart += e;
    });
    id = preIdArr.join("-");
  }
  let inputStr = "DATABASE_IDS=" + id + "\n";

  const file = openSync(".env", "a+");
  const content = readFileSync(file, { encoding: "utf-8" });
  if (!/(?:\n$)|(?:^$)/m.test(content)) {
    inputStr = "\n" + inputStr;
  }
  appendFileSync(".env", inputStr);
  return id;
};
