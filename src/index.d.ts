export type NodeType = 'root' | 'dealer' | 'agent' | 'hall';
export interface Permission {
  key: string;
  action: string;
  target_type: NodeType | '';
  section: string;
  name: string;
  applies_to: NodeType[];
  roles: string[];
  requires: string[];
  relation: 'self' | 'subtree' | 'descendant';
}
export interface Operation {operation: string; method: string; path: string}
export const contract: {
  name: string;
  version: string;
  permissions: Permission[];
  routes: Operation[];
  pocketbase: {collections: Record<string, {auth?: boolean; realtime?: boolean; queryFields?: string[]}>};
};
export const operations: Readonly<Record<string, Operation>>;
export const collections: typeof contract.pocketbase.collections;
export function path(operation: string, params?: Record<string, string>): string;
