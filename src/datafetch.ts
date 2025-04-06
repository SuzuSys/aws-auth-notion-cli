import { Prefix, ServiceName } from "./sanitize";

const IAM_DATASET =
  "https://raw.githubusercontent.com/iann0036/iam-dataset/main/aws/iam_definition.json";
let DATA: Service[];
type Index = number;
const prefix2Index: Map<Prefix, Index> = new Map();

/**
 * fetch DATA from Iam Dataset
 */
export async function fetchIamDataset() {
  if (DATA) {
    console.warn("Multiple calls to fetchIamDataset() detected.");
  } else {
    const response = await fetch(IAM_DATASET);
    DATA = await response.json();
    DATA.forEach((service, i) => prefix2Index.set(service.prefix, i));
  }
}

/**
 * get service
 * @returns service
 */
export function getService(prefix: Prefix): Service {
  const idx = prefix2Index.get(prefix);
  if (idx) return DATA[idx];
  else {
    // impossible
    throw Error("unexpected error");
  }
}

export function getServiceNameMap(): Map<Prefix, ServiceName> {
  const serviceNameMap = new Map();
  for (const [prefix, _] of prefix2Index) {
    serviceNameMap.set(prefix, getService(prefix).service_name);
  }
  return serviceNameMap;
}

interface Service {
  conditions: {
    condition: string;
    description: string;
    type:
      | "String"
      | "ArrayOfString"
      | "ARN"
      | "ArrayOfBool"
      | "Bool"
      | "Numeric"
      | "ArrayOfARN"
      | "Data"
      | "IPAddress";
  }[];
  prefix: string;
  privileges: {
    access_level:
      | "Read"
      | "Write"
      | "List"
      | "Tagging"
      | "Permissions management";
    description: string;
    privilege: string;
    resource_types: {
      condition_keys: string[];
      dependent_actions: string[];
      resource_type: string;
    }[];
  }[];
  resources: {
    arn: string;
    condition_keys: string[];
    resource: string;
  }[];
  service_name: string;
}
