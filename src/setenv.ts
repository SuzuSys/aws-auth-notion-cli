import { openSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";

/**
 * If specified key exists in .env then update value, else add specified key and value.
 * @param key must be matched as \^[\w-]+$\. DO NOT INCLUDE PERIOD.
 * @param value must be matched as \^[^#\r\n]+$\.
 */
export const updateEnv = (key: string, value: string) => {
  const file = openSync(".env", "r+");
  let content = readFileSync(file, { encoding: "utf-8" });
  if (RegExp(`^\\s*${key}\\s*(?:=|:\\s)`, "m").test(content)) {
    content = content.replace(
      RegExp(`(?<=^\\s*${key}\\s*(?:=|:\\s))\\s*[^#\\r\\n]+`, "m"),
      value
    );
    writeFileSync(".env", content);
  } else {
    let line = `${key}=${value}\n`;
    if (!/(?:\n$)|(?:^$)/m.test(content)) {
      line = "\n" + line;
    }
    appendFileSync(".env", line, { flag: "a" });
  }
};

/**
 * delete specified key from .env
 * @param key must be matched as \^[\w-]+$\. DO NOT INCLUDE PERIOD.
 */
export const deleteEnv = (key: string) => {
  const file = openSync(".env", "r+");
  const content = readFileSync(file, { encoding: "utf-8" });
  const deleted = content.replace(
    RegExp(`^\\s*${key}\\s*(?:=|:\\s)\\s*[^#\\r\\n]+`, "m"),
    ""
  );
  writeFileSync(".env", deleted, { flag: "w" });
};
