#!/usr/bin/env node

import { Client } from "@notionhq/client";
import { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import dotenv from "dotenv";
import { setToken, setDatabaseID } from "./setenv";

dotenv.config({ override: true });

(async () => {
  if (!process.env.NOTION_TOKEN) {
    const token = await setToken();
    process.env.NOTION_TOKEN = token;
  }
  const notion = new Client({
    auth: process.env.NOTION_TOKEN,
  });
  let database_id: string;
  if (!process.env.DATABASE_IDS) {
    database_id = await setDatabaseID();
    process.env.DATABASE_IDS = database_id;
  }
  const response = await notion.databases.query({
    database_id: process.env.DATABASE_IDS as string,
  });

  let results: Array<PageObjectResponse>;

  if (response.results[0].object === "page" && "url" in response.results[0]) {
    results = response.results as Array<PageObjectResponse>;
  } else {
    throw Error("Cannot convert results to Array<PageObjectResponse>");
  }

  const properties = results.map((e) => e.properties);

  console.log(properties);
})()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
