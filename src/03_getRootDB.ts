import { Client, APIResponseError } from "@notionhq/client";
import {
  ChildDatabaseBlockObjectResponse,
  ListBlockChildrenResponse,
  CreateDatabaseResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { forEach } from "p-iteration";
import { createPlainDbParameter, validateRootDb } from "./sanitize";
import { input, select, Separator } from "@inquirer/prompts";
import { inquirerErrorHandle } from "./errorHundle";
import { policiesChoice, policiesMap, Policy } from "./policies";

/**
 * get child databases and select a root database
 * @param client
 * @param pageID
 * @returns root database id
 */
export default async function getRootDB(
  client: Client,
  pageID: string
): Promise<{
  rootDbId: string;
  policy: Policy;
}> {
  const { results }: ListBlockChildrenResponse =
    await client.blocks.children.list({
      block_id: pageID,
    });
  const childDbs: ChildDatabaseBlockObjectResponse[] = results.filter(
    (e) => "type" in e && e.type === "child_database"
  );
  const childValidDbAndPolicies: {
    childDb: ChildDatabaseBlockObjectResponse;
    policy: Policy;
  }[] = [];
  await forEach(childDbs, async (e) => {
    const response = await client.databases.retrieve({
      database_id: e.id,
    });
    const policy = validateRootDb(response);
    if (policy) {
      childValidDbAndPolicies.push({
        childDb: e,
        policy,
      });
    }
  });
  if (childValidDbAndPolicies.length === 0) {
    // make a root database
    return await makeRootDb(client, pageID);
  } else {
    // select a root database
    // or make one
    const CREATE = "CREATE";
    interface ChoiceDb {
      name: string; // database title
      value:
        | {
            rootDbId: string;
            policy: Policy;
          }
        | typeof CREATE;
    }
    const choiceDbs: (ChoiceDb | Separator)[] = childValidDbAndPolicies.map(
      ({ childDb, policy }) => ({
        name: childDb.child_database.title,
        value: {
          rootDbId: childDb.id,
          policy,
        },
      })
    );
    choiceDbs.push(new Separator());
    choiceDbs.push({ name: "Create a new root database", value: CREATE });
    const answer = await select({
      message: "Select a root database to use.",
      choices: choiceDbs,
    }).catch(inquirerErrorHandle());

    if (answer === CREATE) {
      return await makeRootDb(client, pageID);
    } else {
      return answer;
    }
  }
}

/**
 * create root database and return database id
 * @param client
 * @param pageID
 * @returns root database id and policy
 */
async function makeRootDb(
  client: Client,
  pageID: string
): Promise<{
  rootDbId: string;
  policy: Policy;
}> {
  const policyName = await select({
    message: "Select a root database policy.",
    choices: policiesChoice,
  }).catch(inquirerErrorHandle());
  const policy = policiesMap[policyName];
  let res: CreateDatabaseResponse | undefined;
  await input({
    message: "Enter a root database name.",
    required: true,
    validate: async (rawDatabaseName): Promise<string | boolean> => {
      const newDb = createPlainDbParameter(pageID, rawDatabaseName, policy);
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
  return {
    rootDbId: res.id,
    policy,
  };
}
