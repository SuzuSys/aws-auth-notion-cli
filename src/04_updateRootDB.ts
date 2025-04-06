import { Client, collectPaginatedAPI, isFullDatabase } from "@notionhq/client";
import { GetDatabaseResponse } from "@notionhq/client/build/src/api-endpoints";
import {
  createPlainRecordParameter,
  createPlainRichTextItem,
  Prefix,
  PREFIX,
  SERVICE_NAME,
  ServiceName,
} from "./sanitize";
import { green, red } from "yoctocolors-cjs";
import { checkbox } from "@inquirer/prompts";
import { inquirerErrorHandle } from "./errorHundle";
import { forEach } from "p-iteration";
import { Policy } from "./policies";
import { getService, getServiceNameMap } from "./datafetch";

/**
 * get info about idMap and approveMap, and update root database.
 * @param client
 * @param rootDbID
 * @param rootDb
 * @param serviceNameInIamMap
 * @returns idMap which contain the intersection set of IamDataset and Notion database
 */
export default async function updateRootDB(
  client: Client,
  rootDbID: string,
  rootDb: GetDatabaseResponse,
  policy: Policy
): Promise<Map<Prefix, string>> {
  const idMap = new Map<Prefix, string>(); // prefix: id
  const serviceNameInNotionMap = new Map<Prefix, ServiceName>(); // prefix: service_name
  // query database
  const queried = await collectPaginatedAPI(client.databases.query, {
    database_id: rootDbID,
    filter_properties: [
      rootDb.properties[PREFIX].id,
      rootDb.properties[SERVICE_NAME].id,
      ...Object.keys(policy.rootDbProp).map(
        (prop) => rootDb.properties[prop].id
      ),
    ],
  });
  queried.forEach((e) => {
    if (!isFullDatabase(e)) {
      console.warn("Unexpected object detected.", e);
      return;
    }
    if (
      "title" in e.properties[PREFIX] &&
      Array.isArray(e.properties[PREFIX].title)
    ) {
      const prefix: Prefix = e.properties[PREFIX].title[0].plain_text;
      let serviceName;
      if (
        "rich_text" in e.properties[SERVICE_NAME] &&
        Array.isArray(e.properties[SERVICE_NAME].rich_text)
      ) {
        serviceName = e.properties[SERVICE_NAME].rich_text[0].plain_text;
      } else {
        console.error("Unexpected object detected.", e);
        return;
      }
      idMap.set(prefix, e.id);
      serviceNameInNotionMap.set(prefix, serviceName);
      policy.extractProp(prefix, e);
    } else {
      console.error("Unexpected object detected.", e);
      return;
    }
  });

  // get difference set
  interface Choice {
    name: string;
    value: Prefix; // prefix
  }
  const nameChangePrefixes: Choice[] = [];
  const minusPrefixes: Choice[] = [];
  const plusPrefixes: Choice[] = [];
  {
    const latestServiceNameMap = getServiceNameMap();
    serviceNameInNotionMap.forEach((service_name, prefix) => {
      const latest_service = latestServiceNameMap.get(prefix);
      if (latest_service) {
        if (service_name !== latest_service) {
          nameChangePrefixes.push({
            name: `${prefix}: ${red(service_name)} => ${green(latest_service)}`,
            value: prefix,
          });
        }
        latestServiceNameMap.delete(prefix);
      } else {
        minusPrefixes.push({
          name: `${red("-")} ${red(prefix)}`,
          value: prefix,
        });
      }
    });
    latestServiceNameMap.forEach((_, prefix) => {
      plusPrefixes.push({
        name: `${green("+")} ${green(prefix)}`,
        value: prefix,
      });
    });
  }
  if (nameChangePrefixes.length !== 0) {
    const fixServiceNamesPrefixes = await checkbox({
      message:
        "The following are the updated service names. Select the ones to fix.",
      choices: nameChangePrefixes,
    }).catch(inquirerErrorHandle());
    await forEach(fixServiceNamesPrefixes, async (prefix) => {
      const pageId = idMap.get(prefix);
      const serviceName = getService(prefix).service_name;
      if (pageId && serviceName) {
        await client.pages.update({
          page_id: pageId,
          properties: {
            [SERVICE_NAME]: createPlainRichTextItem(serviceName),
          },
        });
      } else {
        // impossible
      }
    });
  }
  if (minusPrefixes.length !== 0) {
    const removePrefixes = await checkbox({
      message:
        "The following prefixes have been removed. Select the ones to remove from the Notion database.",
      choices: minusPrefixes,
    }).catch(inquirerErrorHandle());
    await forEach(removePrefixes, async (prefix) => {
      const pageId = idMap.get(prefix);
      if (pageId) {
        await client.pages.update({
          page_id: pageId,
          archived: true,
        });
      } else {
        // impossible
      }
    });
  }
  if (plusPrefixes.length !== 0) {
    const addPrefixes = await checkbox({
      message:
        "The following prefixes have been added. Select the ones to add to the Notion database.",
      choices: plusPrefixes,
    });
    await forEach(addPrefixes, async (prefix) => {
      const serviceName = getService(prefix).service_name;
      if (serviceName) {
        const createdPage = await client.pages.create(
          createPlainRecordParameter(rootDbID, prefix, serviceName, policy)
        );
        idMap.set(prefix, createdPage.id);
        policy.addPlainRecordCallback(prefix);
      } else {
        // impossible
      }
    });
  }
  minusPrefixes.forEach((prefix) => {
    idMap.delete(prefix.value);
    policy.deleteRecordCallback(prefix.value);
  });

  return idMap;
}
