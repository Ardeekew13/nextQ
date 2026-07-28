import { DocumentNode } from "graphql";

export function getQueryDepth(doc: DocumentNode | undefined): number {
  if (!doc) return 0;

  let maxDepth = 0;

  function getDepth(node: any, depth: number): void {
    if (!node) return;

    if (node.selectionSet) {
      depth += 1;
      maxDepth = Math.max(maxDepth, depth);

      for (const selection of node.selectionSet.selections) {
        getDepth(selection, depth);
      }
    }
  }

  for (const definition of doc.definitions) {
    getDepth(definition, 0);
  }

  return maxDepth;
}
