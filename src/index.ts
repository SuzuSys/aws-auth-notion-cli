#!/usr/bin/env node

import { Client } from "@notionhq/client";
import { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import dotenv from "dotenv";

dotenv.config();

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

(async () => {
  const response = await notion.databases.query({
    database_id: process.env.DATABASE_ID as string,
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
