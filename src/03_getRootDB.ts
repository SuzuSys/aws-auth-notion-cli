import { Client, APIResponseError } from "@notionhq/client";
import {
  ChildDatabaseBlockObjectResponse,
  ListBlockChildrenResponse,
  CreateDatabaseResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { filter } from "p-iteration";
import { createPlainDbParameter, validateRootDb } from "./sanitize";
import { input, select, Separator } from "@inquirer/prompts";
import { inquirerErrorHandle } from "./errorHundle";

/**
 * get child databases and select a root database
 * @param client
 * @param pageID
 * @returns root database id
 */
export default async function getRootDB(
  client: Client,
  pageID: string
): Promise<string> {
  const { results }: ListBlockChildrenResponse =
    await client.blocks.children.list({
      block_id: pageID,
    });
  const childDbs: ChildDatabaseBlockObjectResponse[] = results.filter(
    (e) => "type" in e && e.type === "child_database"
  );
  const childRootDbs = await filter(childDbs, async (e) => {
    const response = await client.databases.retrieve({
      database_id: e.id,
    });
    return validateRootDb(response);
  });
  if (childRootDbs.length === 0) {
    // make a root database
    const rootDbID = await makeRootDb(client, pageID);
    return rootDbID;
  } else {
    // select a root database
    // or make one
    interface ChoiceDb {
      name: string; // database title
      value: string; // database id
    }
    const choiceDbs: (ChoiceDb | Separator)[] = childRootDbs.map((e) => ({
      name: e.child_database.title,
      value: e.id,
    }));
    choiceDbs.push(new Separator());
    const CREATE = "CREATE";
    choiceDbs.push({ name: "Create a new root database", value: CREATE });
    const answer = await select({
      message: "Select a root database to use.",
      choices: choiceDbs,
    }).catch(inquirerErrorHandle());

    if (answer === CREATE) {
      const rootDbID = await makeRootDb(client, pageID);
      return rootDbID;
    } else {
      return answer;
    }
  }
}

/**
 * create root database and return database id
 * @param client
 * @param pageID
 * @returns root database id
 */
async function makeRootDb(client: Client, pageID: string): Promise<string> {
  let res: CreateDatabaseResponse | undefined;
  await input({
    message: "Enter a root database name.",
    required: true,
    validate: async (rawDatabaseName): Promise<string | boolean> => {
      const newDb = createPlainDbParameter(pageID, rawDatabaseName);
      try {
        res = await client.databases.create(newDb);
        return true;
      } catch (e) {
        if (e instanceof APIResponseError) {
          return e.message;
        } else {
          return "Unexpected error.";
        }
      }
    },
  }).catch(inquirerErrorHandle());
  if (!res) {
    throw Error("Unexpected error occurred.");
  }
  return res.id;
}
