/**
 * Aggregate policies
 */
import type {
  CreateDatabaseParameters,
  CreatePageParameters,
  DatabaseObjectResponse,
  GetDatabaseResponse,
} from "@notionhq/client/build/src/api-endpoints.d";
import { SCP0 } from "./SCP0";
import { Prefix, ServiceName } from "../sanitize";
import { Client } from "@notionhq/client";

export const policies = ["SCP0"] as const;
export type policyUnion = (typeof policies)[number];

export const policiesChoice: {
  value: policyUnion;
  description: string;
}[] = [
  {
    value: "SCP0",
    description: "For SCP",
  },
] as const;

export interface Policy {
  name: policyUnion;
  rootDbProp: CreateDatabaseParameters["properties"];
  createPlainDbProp: (
    seed: CreateDatabaseParameters
  ) => CreateDatabaseParameters;
  createPlainRecordProp: (seed: CreatePageParameters) => CreatePageParameters;
  validProp: (obj: GetDatabaseResponse) => boolean;
  extractProp: (prefix: Prefix, obj: DatabaseObjectResponse) => void;
  addPlainRecordCallback: (prefix: Prefix) => void;
  deleteRecordCallback: (prefix: Prefix) => void;
  updateOther: (
    client: Client,
    rootDbID: string,
    rootDb: GetDatabaseResponse
  ) => Promise<void>;
}

export const policiesMap: Record<policyUnion, Policy> = {
  SCP0,
};
