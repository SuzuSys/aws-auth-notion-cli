#!/usr/bin/env node
import dotenv from "dotenv";
import { fetchIamDataset } from "./datafetch";
import getNotionClient from "./01_getNotionClient";
import getPageID from "./02_getPageID";
import getRootDB from "./03_getRootDB";
import updateRootDB from "./04_updateRootDB";
import { GetDatabaseResponse } from "@notionhq/client/build/src/api-endpoints";

dotenv.config();

(async () => {
  // get a Notion clinet
  // if the user registered a new Notion token, update .env
  const { token, client } = await getNotionClient();
  // get page id
  const pageID = await getPageID(token);
  // get child databases and select a root database
  const { rootDbId, policy } = await getRootDB(client, pageID);
  // get root db
  const rootDb: GetDatabaseResponse = await client.databases.retrieve({
    database_id: rootDbId,
  });
  // fetch data from iamdataset and save global variables
  await fetchIamDataset();
  // get info about idMap and approveMap, and update root database
  const idMap = await updateRootDB(client, rootDbId, rootDb, policy);
  // update other
})()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
