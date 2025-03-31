#!/usr/bin/env node
import dotenv from "dotenv";
import { fetchIamDataset, getServiceNames } from "./datafetch";
import getNotionClient from "./01_getNotionClient";
import getPageID from "./02_getPageID";
import getRootDB from "./03_getRootDB";
import updateRootDB from "./04_updateRootDB";

dotenv.config();

(async () => {
  // get a Notion clinet
  // if the user registered a new Notion token, update .env
  const { token, client } = await getNotionClient();
  // get page id
  const pageID: string = await getPageID(token);
  // get child databases
  const rootDbID: string = await getRootDB(client, pageID);
  // get root db
  const rootDb = await client.databases.retrieve({
    database_id: rootDbID,
  });
  // fetch data from iamdataset and save global variables
  await fetchIamDataset();
  // Map<prefix, service_name>
  const serviceNameInIamMap = getServiceNames();
  // get info about idMap and approveMap, and update root database
  const { idMap, approveMap } = await updateRootDB(
    client,
    rootDbID,
    rootDb,
    serviceNameInIamMap
  );
})()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
