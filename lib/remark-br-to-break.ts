import { visitParents } from "unist-util-visit-parents";

const BR_HTML_ONLY = /^<br\s*\/?>$/i;
const BR_INLINE_GLOBAL = /(?:<br\s*\/?>|&lt;br\s*\/?&gt;)/gi;
const BR_INLINE = /(?:<br\s*\/?>|&lt;br\s*\/?&gt;)/i;

const isInsideCode = (ancestors: any[]): boolean =>
  ancestors.some((a) => a && (a.type === "code" || a.type === "inlineCode"));

/**
 * Safely renders literal `<br>` tags as Markdown hard line breaks, without
 * enabling arbitrary raw HTML rendering.
 *
 * This supports both raw `<br>` and escaped `&lt;br&gt;` sequences.
 */
export const remarkBrToBreak = () => {
  return (tree: any) => {
    visitParents(
      tree,
      (node: any) => node && (node.type === "text" || node.type === "html"),
      (node: any, ancestors: any[]) => {
        if (isInsideCode(ancestors)) return;

        const parent = ancestors[ancestors.length - 1] as any;
        if (!parent || !Array.isArray(parent.children)) return;

        const index = parent.children.indexOf(node);
        if (index === -1) return;

        if (node.type === "html") {
          const value = String(node.value ?? "").trim();
          if (BR_HTML_ONLY.test(value)) {
            parent.children.splice(index, 1, { type: "break" });
          }
          return;
        }

        const value = String(node.value ?? "");
        if (!BR_INLINE.test(value)) return;

        const next: any[] = [];
        BR_INLINE_GLOBAL.lastIndex = 0;
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = BR_INLINE_GLOBAL.exec(value)) !== null) {
          const before = value.slice(lastIndex, match.index);
          if (before) next.push({ type: "text", value: before });
          next.push({ type: "break" });
          lastIndex = match.index + match[0].length;
        }

        const after = value.slice(lastIndex);
        if (after) next.push({ type: "text", value: after });

        if (next.length > 0) {
          parent.children.splice(index, 1, ...next);
        }
      }
    );
  };
};

