import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SERVER_SOURCE_ROOTS = [
  'src/app/api',
  'src/lib',
];

describe('server logging source audit', () => {
  it('uses the safe logger rather than direct console calls', () => {
    const violations = SERVER_SOURCE_ROOTS.flatMap(findDirectConsoleCalls);

    expect(violations).toEqual([]);
  });
});

function findDirectConsoleCalls(root: string): string[] {
  return visitDirectory(root).flatMap((filePath) => {
    const contents = readFileSync(filePath, 'utf8');
    const relativePath = relative(process.cwd(), filePath);
    const sourceFile = ts.createSourceFile(filePath, contents, ts.ScriptTarget.Latest, true);
    const violations: string[] = [];

    function visit(node: ts.Node): void {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const receiver = node.expression.expression;
        const method = node.expression.name.text;
        if (
          ts.isIdentifier(receiver)
          && receiver.text === 'console'
          && ['debug', 'error', 'info', 'log', 'warn'].includes(method)
        ) {
          const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          violations.push(`${relativePath}:${position.line + 1}`);
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return violations;
  });
}

function visitDirectory(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : visitDirectory(entryPath);
    }

    return /\.tsx?$/.test(entry.name) && entryPath !== 'src/lib/server-logger.ts'
      ? [entryPath]
      : [];
  });
}
