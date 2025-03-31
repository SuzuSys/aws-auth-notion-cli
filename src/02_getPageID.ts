import { checkbox, input, select, Separator } from "@inquirer/prompts";
import { forEach } from "p-iteration";
import { pageIDRe, sanitizePageID, validatePageID } from "./sanitize";
import { inquirerErrorHandle } from "./errorHundle";
import { deleteEnv, updateEnv } from "./setenv";

const ROOT_PAGE_IDS = "ROOT_PAGE_IDS";

/**
 * get page id
 * @param token
 * @returns
 */
export default async function getPageID(token: string): Promise<string> {
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
    interface ChoiceInvalidPageID {
      description: string; // invalid factor
      name: string; // invalid page id
      value: number; // index of rawPageIDs
    }
    const choiceInvalidPageIDs: ChoiceInvalidPageID[] = [];
    interface ChoicePage {
      name: string; // page title
      value: string; // page id
    }
    const choicePages: (ChoicePage | Separator)[] = [];
    // pageIDs[].value is sorted (ascending order)
    const _ = await forEach(rawPageIDs, async (rawPageID, index) => {
      if (!pageIDRe.test(rawPageID)) {
        choiceInvalidPageIDs.push({
          description: "Invalid format",
          name: rawPageID,
          value: index,
        });
        return false;
      }
      const { valid, result } = await validatePageID(rawPageID, token);
      if (valid) {
        choicePages.push({ name: result, value: rawPageID });
        return true;
      } else {
        choiceInvalidPageIDs.push({
          description: result,
          name: rawPageID,
          value: index,
        });
      }
      return true;
    });
    if (choiceInvalidPageIDs.length !== 0) {
      const invalidIndex = await checkbox({
        message: "The Following IDs are invalid. Select one to delete.",
        choices: choiceInvalidPageIDs,
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

    if (choicePages.length === 0) {
      // register a new page id
      const pageID = await getNewRootPageId(token, []);
      updateEnv(ROOT_PAGE_IDS, pageID);
      return pageID;
    } else {
      // select from the existing page ids
      // or register a new page id
      choicePages.push(new Separator());
      const REGISTER = "REGISTER";
      choicePages.push({
        name: "Register a new root page id",
        value: REGISTER,
      });
      const answer = await select({
        message: "Select a page to use.",
        choices: choicePages,
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
}

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
      "What is a new root page id or url? (The entered url will be automatically converted to an id.)",
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
