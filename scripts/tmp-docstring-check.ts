import fs from "fs";
import path from "path";
import ts from "typescript";

const ROOT = process.cwd();
const INCLUDE_DIRS = ["app", "components", "convex", "hooks", "lib", "scripts", "types", "__tests__"];
const EXCLUDE_DIRS = new Set(["node_modules", ".next", ".git", ".idea", ".opencode", ".vscode", "dist", "build"]); 

function isTsFile(filePath: string): boolean {
  return filePath.endsWith(".ts") || filePath.endsWith(".tsx");
}

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (entry.isFile() && isTsFile(full)) {
      files.push(full);
    }
  }
  return files;
}

function hasJsDoc(node: ts.Node): boolean {
  const docs = ts.getJSDocCommentsAndTags(node);
  return docs.length > 0;
}

function getLeadingJsDocForVariable(node: ts.VariableDeclaration): boolean {
  const parent = node.parent; // VariableDeclarationList
  const stmt = parent.parent; // VariableStatement
  return hasJsDoc(node) || hasJsDoc(stmt);
}

function collect(filePath: string) {
  const sourceText = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const missing: Array<{ name: string; kind: string; line: number }> = [];
  let total = 0;
  let documented = 0;

  function record(name: string, kind: string, node: ts.Node, documentedHere: boolean) {
    total += 1;
    if (documentedHere) {
      documented += 1;
    } else {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      missing.push({ name, kind, line: line + 1 });
    }
  }

  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node)) {
      const name = node.name?.text ?? "<anonymous>";
      record(name, "function", node, hasJsDoc(node));
    } else if (ts.isMethodDeclaration(node)) {
      const name = node.name?.getText(sourceFile) ?? "<anonymous>";
      record(name, "method", node, hasJsDoc(node));
    } else if (ts.isVariableDeclaration(node)) {
      const init = node.initializer;
      if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
        const name = node.name.getText(sourceFile);
        record(name, "variable", node, getLeadingJsDocForVariable(node));
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return { missing, total, documented };
}

const files: string[] = [];
for (const dir of INCLUDE_DIRS) {
  const full = path.join(ROOT, dir);
  if (fs.existsSync(full)) walk(full, files);
}

let grandTotal = 0;
let grandDoc = 0;
const report: Array<{ file: string; missing: ReturnType<typeof collect>["missing"] }> = [];

for (const filePath of files) {
  const { missing, total, documented } = collect(filePath);
  grandTotal += total;
  grandDoc += documented;
  if (missing.length > 0) {
    report.push({ file: path.relative(ROOT, filePath), missing });
  }
}

const coverage = grandTotal === 0 ? 100 : (grandDoc / grandTotal) * 100;
console.log(`Docstring coverage: ${coverage.toFixed(2)}% (${grandDoc}/${grandTotal})`);

for (const entry of report) {
  for (const item of entry.missing) {
    console.log(`${entry.file}:${item.line} - ${item.kind} ${item.name}`);
  }
}
