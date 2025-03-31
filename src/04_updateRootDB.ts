import {
  Client,
  collectPaginatedAPI,
  isFullPageOrDatabase,
} from "@notionhq/client";
import {
  GetDatabaseResponse,
  TextRichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { APPROVE, PREFIX, READ, SERVICE_NAME, WRITE } from "./sanitize";
import { getServiceNames } from "./datafetch";
import { green, red } from "yoctocolors-cjs";
import { checkbox } from "@inquirer/prompts";
import { inquirerErrorHandle } from "./errorHundle";
import { forEach } from "p-iteration";

/**
 * get info about idMap and approveMap, and update root database.
 * @param client
 * @param rootDbID
 * @param rootDb
 * @param serviceNameInIamMap
 * @returns idMap and approveMap which contain the intersection set of IamDataset and Notion database
 */
export default async function updateRootDB(
  client: Client,
  rootDbID: string,
  rootDb: GetDatabaseResponse,
  serviceNameInIamMap: Map<string, string>
): Promise<{
  idMap: Map<string, string>;
  approveMap: Map<string, { read: boolean; write: boolean }>;
}> {
  const idMap = new Map<string, string>(); // prefix: id
  const approveMap = new Map<string, { read: boolean; write: boolean }>(); // prefix: approve
  const serviceNameInNotionMap = new Map<string, string>(); // prefix: service_name
  // query database
  const queried = await collectPaginatedAPI(client.databases.query, {
    database_id: rootDbID,
    filter_properties: [
      rootDb.properties[PREFIX].id,
      rootDb.properties[SERVICE_NAME].id,
      rootDb.properties[APPROVE].id,
    ],
  });
  queried.forEach((e) => {
    if (!isFullPageOrDatabase(e)) {
      console.warn("Unexpected object detected.", e);
      return;
    }
    if (
      "title" in e.properties[PREFIX] &&
      e.properties[PREFIX].title &&
      Array.isArray(e.properties[PREFIX].title)
    ) {
      const prefix = e.properties[PREFIX].title[0].plain_text;
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
      const approve = { read: false, write: false };
      if (
        "multi_select" in e.properties[APPROVE] &&
        "options" in e.properties[APPROVE].multi_select
      ) {
        for (const s of e.properties[APPROVE].multi_select.options) {
          approve.read = s.name === READ;
          approve.write = s.name === WRITE;
        }
      }
      idMap.set(prefix, e.id);
      serviceNameInNotionMap.set(prefix, serviceName);
      approveMap.set(prefix, approve);
    } else {
      console.error("Unexpected object detected.", e);
      return;
    }
  });

  // get difference set
  interface Choice {
    name: string;
    value: string; // prefix
  }
  const nameChangePrefixes: Choice[] = [];
  const minusPrefixes: Choice[] = [];
  const plusPrefixes: Choice[] = [];
  {
    const latestServiceNameMap = getServiceNames();
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
      const serviceName = serviceNameInIamMap.get(prefix);
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
      const serviceName = serviceNameInIamMap.get(prefix);
      if (serviceName) {
        const createdPage = await client.pages.create({
          parent: {
            database_id: rootDbID,
          },
          properties: {
            [PREFIX]: {
              type: "title",
              title: createPlainRichTextItem(prefix),
            },
            [SERVICE_NAME]: {
              type: "rich_text",
              rich_text: createPlainRichTextItem(serviceName),
            },
          },
        });
        idMap.set(prefix, createdPage.id);
        approveMap.set(prefix, { read: false, write: false });
      } else {
        // impossible
      }
    });
  }
  minusPrefixes.forEach((prefix) => {
    idMap.delete(prefix.value);
    approveMap.delete(prefix.value);
  });

  return {
    idMap,
    approveMap,
  };
}

/**
 * Create a new TextRichTextItem object.
 * @param text plane text
 * @returns a new TextRichTextItem object
 */
function createPlainRichTextItem(text: string): TextRichTextItemResponse[] {
  return [
    {
      type: "text",
      text: {
        content: text,
        link: null,
      },
      annotations: {
        bold: false,
        italic: false,
        strikethrough: false,
        underline: false,
        code: false,
        color: "default",
      },
      plain_text: text,
      href: null,
    },
  ];
}
