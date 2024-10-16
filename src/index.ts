#!/usr/bin/env node

import { Client } from "@notionhq/client";
import type {
  ListBlockChildrenResponse,
  ChildDatabaseBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints.d";
import dotenv from "dotenv";
import { updateEnv, deleteEnv } from "./setenv";
import {
  validateNotionToken,
  validatePageID,
  sanitizePageID,
  pageIDRe,
} from "./sanitize";
import { forEach } from "p-iteration";
import { input, confirm, checkbox, select, Separator } from "@inquirer/prompts";

dotenv.config();

const NOTION_TOKEN = "NOTION_TOKEN";
const ROOT_PAGE_IDS = "ROOT_PAGE_IDS";

(async () => {
  // get a Notion clinet
  // if the user registered a new Notion token, update .env
  const { token, client } = await (async (): Promise<{
    token: string;
    client: Client;
  }> => {
    if (process.env[NOTION_TOKEN]) {
      const client = new Client({
        auth: process.env[NOTION_TOKEN],
      });
      // validate the notion token
      const valid = await validateNotionToken(process.env[NOTION_TOKEN]);
      if (typeof valid === "string") {
        // confirm deletion of the Notion token. and exit process.
        console.log(valid);
        const d = await confirm({
          message:
            "The registered Notion token is invalid. Do you want to delete the registered token?",
        }).catch(inquirerErrorHandle());
        if (d) {
          deleteEnv(NOTION_TOKEN);
          console.log(
            "Please execute this CLI again and register a new Notion token."
          );
        } else {
          console.log(
            "If you delete the registered Notion token, you can register a new one."
          );
        }
        process.exit(0);
      }
      return { token: process.env[NOTION_TOKEN], client };
    } else {
      // get a Notion token entered by the user
      const token: string = await input({
        message: "What is your Notion token?\n",
        required: true,
        validate: validateNotionToken,
      }).catch(inquirerErrorHandle());
      // update .env
      updateEnv(NOTION_TOKEN, token);
      return {
        token,
        client: new Client({
          auth: token,
        }),
      };
    }
  })();
  // get page id
  const pageID: string = await (async (): Promise<string> => {
    if (process.env[ROOT_PAGE_IDS]) {
      // select from the existing page ids
      // or register a new page id

      // get root page ids
      let rawPageIDs = process.env[ROOT_PAGE_IDS].split(" ");
      // remove deplicate values
      rawPageIDs = rawPageIDs.filter(
        (str, pos) => rawPageIDs.indexOf(str) == pos
      );
      // validate page ids
      type InvalidPageID = {
        description: string; // invalid factor
        name: string; // invalid page id
        value: number; // index of rawPageIDs
      };
      const invalidPageIDs: InvalidPageID[] = [];
      type Page = {
        name: string; // page title
        value: string; // page id
      };
      const pages: (Page | Separator)[] = [];
      // pageIDs[].value is sorted (ascending order)
      const _ = await forEach(rawPageIDs, async (rawPageID, index) => {
        if (!pageIDRe.test(rawPageID)) {
          invalidPageIDs.push({
            description: "Invalid format",
            name: rawPageID,
            value: index,
          });
          return false;
        }
        const { valid, result } = await validatePageID(rawPageID, token);
        if (valid) {
          pages.push({ name: result, value: rawPageID });
          return true;
        } else {
          invalidPageIDs.push({
            description: result,
            name: rawPageID,
            value: index,
          });
        }
        return true;
      });
      if (invalidPageIDs.length !== 0) {
        const invalidIndex = await checkbox({
          message:
            "The Following IDs are invalid. Select one to delete. Select: ↑↓, Check: Space, Submit: Enter",
          choices: invalidPageIDs,
        }).catch(inquirerErrorHandle());
        // remove id at invalidIndex from rawPageIDs
        invalidIndex.reverse().forEach((i) => rawPageIDs.splice(i, 1));
      }
      // update .env
      if (rawPageIDs.length === 0) {
        deleteEnv(ROOT_PAGE_IDS);
      } else {
        updateEnv(ROOT_PAGE_IDS, rawPageIDs.join(" "));
      }

      if (pages.length === 0) {
        // register a new page id
        const pageID = await getNewRootPageId(token, []);
        updateEnv(ROOT_PAGE_IDS, pageID);
        return pageID;
      } else {
        // select from the existing page ids
        // or register a new page id
        pages.push(new Separator());
        const REGISTER = "register";
        pages.push({
          name: "Register a new root page id",
          value: REGISTER,
        });
        const answer = await select({
          message: "Select a page to use. Select: ↑↓, Submit: Enter",
          choices: pages,
        }).catch(inquirerErrorHandle());
        if (answer === REGISTER) {
          const pageID = await getNewRootPageId(token, rawPageIDs);
          const pageIDs = [...rawPageIDs, pageID];
          updateEnv(ROOT_PAGE_IDS, pageIDs.join(" "));
          return pageID;
        } else {
          return answer;
        }
      }
    } else {
      // register a new page id
      const pageID = await getNewRootPageId(token, []);
      updateEnv(ROOT_PAGE_IDS, pageID);
      return pageID;
    }
  })();
  // get child databases
  const { results }: ListBlockChildrenResponse =
    await client.blocks.children.list({
      block_id: pageID,
    });
  const childDbs: ChildDatabaseBlockObjectResponse[] = results.filter(
    (e) => "type" in e && e.type === "child_database"
  );
  if (childDbs.length === 0) {
    // make a services database
  } else {
    // select a services database
    // or make one
  }
  console.log(childDbs);
  process.exit(0);
  /*
  const response = await notion.databases.query({
    database_id: process.env.PAGE_IDS as string,
  });

  let results: Array<PageObjectResponse>;

  if (response.results[0].object === "page" && "url" in response.results[0]) {
    results = response.results as Array<PageObjectResponse>;
  } else {
    throw Error("Cannot convert results to Array<PageObjectResponse>");
  }

  const properties = results.map((e) => e.properties);

  console.log(properties);
  */
})()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

/**
 * Get a new root page id.
 * @param token Notion token
 * @param registeredPageIDs registered page ids
 * @returns a new root page id user entered (not duplicated with registeredPageIDs)
 */
async function getNewRootPageId(token: string, registeredPageIDs: string[]) {
  let formattedPageID = "";
  await input({
    message:
      "What is a new root page id or url? (The entered url will be automatically converted to an id.)\n",
    required: true,
    validate: async (rawPageID): Promise<string | boolean> => {
      const { result, pageID } = await sanitizePageID(rawPageID, token);
      if (result === true) {
        if (registeredPageIDs.indexOf(pageID) === -1) {
          formattedPageID = pageID;
        } else {
          return "The entered id is already registered.";
        }
      }
      return result;
    },
  }).catch(inquirerErrorHandle());
  if (formattedPageID === "") throw Error("Unexpected error occurred.");
  return formattedPageID;
}

/**
 * The CLI exits without an error message when the user presses Ctrl + C.
 * @returns function.
 */
function inquirerErrorHandle() {
  return (error: { name: string }) => {
    if (error.name !== "ExitPromptError") console.log(error);
    process.exit(0);
  };
}
