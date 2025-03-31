import { Client } from "@notionhq/client";
import { validateNotionToken } from "./sanitize";
import { inquirerErrorHandle } from "./errorHundle";
import { input, confirm } from "@inquirer/prompts";
import { deleteEnv, updateEnv } from "./setenv";

const NOTION_TOKEN = "NOTION_TOKEN";

/**
 * get a Notion client
 * if the user registered a new Notion token, update .env
 * @returns
 */
export default async function getNotionClient(): Promise<{
  token: string;
  client: Client;
}> {
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
}
