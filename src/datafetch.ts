const IAM_DATASET =
  "https://raw.githubusercontent.com/iann0036/iam-dataset/main/aws/iam_definition.json";
let DATA: Service[];

/**
 * fetch DATA from Iam Dataset
 */
export async function fetchIamDataset() {
  const response = await fetch(IAM_DATASET);
  DATA = await response.json();
}

/**
 * get service names
 * @returns Map<prefix, service_name>
 */
export function getServiceNames() {
  const serviceNames = new Map<string, string>();
  DATA.forEach((e) => serviceNames.set(e.prefix, e.service_name));
  return serviceNames;
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
