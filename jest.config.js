/** @type {import('ts-jest').JestConfigWithTsJest} **/
export const testEnvironment = "node";
export const transform = {
  "^.+.tsx?$": ["ts-jest", {}],
};
export const roots = ["<rootDir>/test", "<rootDir>/src"];
