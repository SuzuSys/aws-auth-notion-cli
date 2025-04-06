/**
 * Policy: SCP0
 */

import {
  CreateDatabaseParameters,
  CreatePageParameters,
  DatabaseObjectResponse,
  GetDatabaseResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { Policy } from "..";
import { createPlainRichTextItem, Prefix } from "../../sanitize";
import { Client } from "@notionhq/client";

const APPROVE = "Approve";
const WRITE = "Write";
const READ = "Read";

interface PolicySCP0 extends Policy {
  data: {
    /**
     * which contain the intersection set of IamDataset and Notion database
     */
    approveMap: Map<Prefix, { read: boolean; write: boolean }>;
  };
}

export const SCP0: PolicySCP0 = {
  name: "SCP0",
  rootDbProp: {
    [APPROVE]: {
      type: "multi_select",
      multi_select: {
        options: [
          {
            name: READ,
            color: "yellow",
          },
          {
            name: WRITE,
            color: "green",
          },
        ],
      },
    },
  },
  createPlainDbProp: function (seed: CreateDatabaseParameters) {
    seed.description = createPlainRichTextItem(`policy: ${this.name}`);
    seed.properties = {
      ...seed.properties,
      ...this.rootDbProp,
    };
    return seed;
  },
  createPlainRecordProp: function (seed: CreatePageParameters) {
    return seed;
  },
  validProp: function (obj: GetDatabaseResponse) {
    return (
      "multi_select" in obj.properties[APPROVE] &&
      obj.properties[APPROVE]["multi_select"].options.every(
        ({ name }) => name === WRITE || name === READ
      )
    );
  },
  extractProp: function (prefix: Prefix, obj: DatabaseObjectResponse) {
    const childObj = obj.properties[APPROVE];
    if ("multi_select" in childObj && "options" in childObj.multi_select) {
      const approve = { read: false, write: false };
      let changed = false;
      for (const s of childObj.multi_select.options) {
        if (s.name === READ) {
          approve.read = true;
          changed = true;
        } else if (s.name === WRITE) {
          approve.write = true;
          changed = true;
        }
      }
      if (changed) {
        this.data.approveMap.set(prefix, approve);
      }
    }
  },
  addPlainRecordCallback(_: Prefix) {},
  deleteRecordCallback(prefix: Prefix) {
    this.data.approveMap.delete(prefix);
  },
  updateOther: function (
    client: Client,
    rootDbID: string,
    rootDb: GetDatabaseResponse
  ): Promise<void> {},
  data: {
    approveMap: new Map(),
  },
};
