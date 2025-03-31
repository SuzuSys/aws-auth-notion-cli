import { Client } from "@notionhq/client";
import {
  ChildDatabaseBlockObjectResponse,
  ListBlockChildrenResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { filter } from "p-iteration";
import { validateRootDb } from "./sanitize";
import { select, Separator } from "@inquirer/prompts";
import { inquirerErrorHandle } from "./errorHundle";

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
    // ...
    return "...";
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
      // ...
      return "...";
    } else {
      return answer;
    }
  }
}
