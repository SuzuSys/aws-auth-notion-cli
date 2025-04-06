import { Client, isNotionClientError } from "@notionhq/client";
import type {
  CreateDatabaseParameters,
  CreatePageParameters,
  GetDatabaseResponse,
  GetPageResponse,
  RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints.d";
import { policies, policiesMap, Policy, policyUnion } from "./policies";

export type Prefix = string;
export type ServiceName = string;

export const PREFIX = "Prefix";
export const SERVICE_NAME = "Service Name";

type CrDbParamVals = CreateDatabaseParameters["properties"][string];
type CrDbParamTypes = Exclude<CrDbParamVals["type"], undefined>;
export type CrDbParam<T extends CrDbParamTypes> = Extract<
  CrDbParamVals,
  { type?: T }
>;

type CrPgParamValsRaw = CreatePageParameters["properties"][string];
type CrPgParamVals = Extract<CrPgParamValsRaw, { type?: string }>;
type CrPgParamTypes = Exclude<CrPgParamVals["type"], undefined>;
export type CrPgParam<T extends CrPgParamTypes> = Extract<
  CrPgParamVals,
  { type?: T }
>;

type RichTextItemRequest = CrPgParam<"rich_text">["rich_text"];

/**
 * Check the validity of a Notion token.
 * @param token Notion token
 * @returns If the token is valid, return true. Otherwise, return an error message.
 */
export async function validateNotionToken(
  token: string
): Promise<string | boolean> {
  const notion = new Client({
    auth: token,
    logger: () => {},
  });
  try {
    await notion.users.me({});
    return true;
  } catch (e) {
    if (isNotionClientError(e)) {
      return e.message;
    } else {
      return String(e);
    }
  }
}

export const pageIDRe =
  /^[A-Za-z0-9]{8}-(?:[A-Za-z0-9]{4}-){3}[A-Za-z0-9]{12}$/;

/**
 * Format "rawPageID" into valid page id
 * @param rawPageID [valid page id] or [no hyphen page id] or [page url]
 * @returns If the "rawPageID" is valid, "valid" is true and "result" is a formatted page id.
 * Otherwise, "valid" is false and "result" is an error message.
 */
export function formatPageID(rawPageID: string): {
  valid: boolean;
  result: string;
} {
  if (pageIDRe.test(rawPageID)) {
    return { valid: true, result: rawPageID };
  } else {
    let preID: string;
    if (/^[A-Za-z0-9]{32}$/.test(rawPageID)) {
      preID = rawPageID;
    } else {
      const matched = rawPageID.match(/(?<=\/|\-)[A-Za-z0-9]{32}(?=\?|$)/g);
      if (matched) {
        preID = matched[0];
      } else {
        return { valid: false, result: "Invalid format." };
      }
    }
    const preIDArr: string[] = [];
    let idxStart = 0;
    [8, 4, 4, 4, 12].forEach((e) => {
      preIDArr.push(preID.slice(idxStart, idxStart + e));
      idxStart += e;
    });
    return { valid: true, result: preIDArr.join("-") };
  }
}

/**
 * Validate a page id.
 * @param pageID page id
 * @param token Notion token
 * @returns If "pageID" is valid, "valid" is true and "result" is the page title.
 * Otherwise, "valid" is false and "result" is a error message.
 */
export async function validatePageID(
  pageID: string,
  token: string
): Promise<{ valid: boolean; result: string }> {
  const client = new Client({
    auth: token,
    logger: () => {},
  });
  try {
    const res: GetPageResponse = await client.pages.retrieve({
      page_id: pageID,
    });
    if ("properties" in res && "title" in res.properties.title) {
      return { valid: true, result: res.properties.title.title[0].plain_text };
    } else {
      return {
        valid: false,
        result:
          "Notion's server responded in an unexpected format. It's possible that Notion has updated the API format.",
      };
    }
  } catch {
    return {
      valid: false,
      result: "Could not find this page.",
    };
  }
}

/**
 * Sanitize a page id entered by the user.
 * @param rawPageID [valid page id] or [no hyphen page id] or [page url]
 * @param token Notion token
 * @returns If the "rawPageID" is valid, "result" is true and "pageID" is a formatted page id.
 * Otherwise, "result" is a error message and "pageID" is a empty string.
 */
export async function sanitizePageID(
  rawPageID: string,
  token: string
): Promise<{ result: string | boolean; pageID: string }> {
  // format rawPageID to pageID
  const { valid: valFormat, result: resFormat } = formatPageID(rawPageID);
  if (!valFormat) return { result: resFormat, pageID: "" };
  // confirm notion token
  const { valid: valValidate, result: resValidate } = await validatePageID(
    resFormat,
    token
  );
  if (valValidate) {
    return { result: true, pageID: resFormat };
  } else {
    return { result: resValidate, pageID: "" };
  }
}

const dbPolicyDescRe = new RegExp(
  `(?<=policy: )(${policies.join("|")})(?!\\w)`,
  "m"
);

/**
 * get policy from a root database
 * @param db a root database
 * @returns if description of the db has policy info, then return policy, otherwise, return undefined
 */
export function getPolicy(db: GetDatabaseResponse): Policy | undefined {
  if ("description" in db) {
    for (const item of db.description) {
      const res = dbPolicyDescRe.exec(item.plain_text)?.[0];
      if (res) {
        return policiesMap[res as policyUnion];
      }
    }
  }
}

/**
 * validate a root database
 * @param db a root database
 * @returns if the db is valid as a root database, then return policy, otherwise, return undefined,
 */
export function validateRootDb(db: GetDatabaseResponse): Policy | undefined {
  if (
    db.properties[PREFIX].type === "title" &&
    db.properties[SERVICE_NAME].type === "rich_text"
  ) {
    const policy = getPolicy(db);
    if (policy?.validProp(db)) {
      return policy;
    }
  }
}

/**
 * Create and return a new CreateDatabaseParameters object
 * required for creating a root database
 * @param pageID parent page id
 * @param dbName
 * @returns CreateDatabaseParameters object
 */
export function createPlainDbParameter(
  pageID: string,
  dbName: string,
  policy: Policy
): CreateDatabaseParameters {
  const seed: CreateDatabaseParameters = {
    parent: {
      page_id: pageID,
    },
    title: createPlainRichTextItem(dbName),
    properties: {
      [PREFIX]: {
        title: {},
      },
      [SERVICE_NAME]: {
        rich_text: {},
      },
      ...policy.rootDbProp,
    },
  };
  return policy.createPlainDbProp(seed);
}

/**
 * Create and return a new CreatePageParameters object
 * required for inserting a record in a root database
 * @param rootDbId
 * @returns CreatePageParameters object
 */
export function createPlainRecordParameter(
  rootDbId: string,
  prefix: string,
  serviceName: string,
  policy: Policy
): CreatePageParameters {
  const seed: CreatePageParameters = {
    parent: {
      database_id: rootDbId,
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
  };
  return policy.createPlainRecordProp(seed);
}

/**
 * Create a new TextRichTextItem object.
 * @param text plane text
 * @returns a new TextRichTextItem object
 */
export function createPlainRichTextItem(text: string): RichTextItemRequest {
  return [
    {
      text: {
        content: text,
      },
    },
  ];
}
