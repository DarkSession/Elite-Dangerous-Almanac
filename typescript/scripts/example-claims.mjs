import ts from 'typescript';

export { compareExampleValue } from './example-value-match.mjs';

const CLAIM_MARKER = /^\/\/\s*->\s?(.*)$/s;
const RUNTIME_AMBIENT_KINDS = new Set([
    ts.SyntaxKind.VariableStatement,
    ts.SyntaxKind.FunctionDeclaration,
    ts.SyntaxKind.ClassDeclaration,
    ts.SyntaxKind.EnumDeclaration,
    ts.SyntaxKind.ModuleDeclaration,
]);

/**
 * Find, classify and instrument the value claims in one documented TypeScript snippet.
 *
 * A machine-readable claim is attached to the executable expression immediately before
 * it, either on the same line or on the following line. Prose, abbreviated literals and
 * snippets that need an ambient runtime value remain compile-only and are reported as
 * skipped rather than guessed at.
 *
 * @param {string} code - The snippet source.
 * @param {{ idPrefix?: string }} [options] - A stable prefix for generated claim ids.
 * @returns {{ code: string, claims: object[], skipped: object[], ambient: boolean }}
 */
export function transformExampleClaims(code, { idPrefix = 'claim' } = {}) {
    const source = ts.createSourceFile(
        'example.ts',
        code,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
    );
    const targets = [];
    const identifiers = new Set();
    let ambient = false;

    function visit(node) {
        if (ts.isIdentifier(node)) identifiers.add(node.text);
        if (ts.isExpressionStatement(node)) {
            targets.push({ statement: node, expression: node.expression });
        } else if (ts.isVariableStatement(node) && node.declarationList.declarations.length === 1) {
            const declaration = node.declarationList.declarations[0];
            if (ts.isIdentifier(declaration.name) && declaration.initializer !== undefined) {
                targets.push({ statement: node, expression: declaration.initializer });
            }
        }
        if (
            RUNTIME_AMBIENT_KINDS.has(node.kind) &&
            node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword)
        ) {
            ambient = true;
        }
        ts.forEachChild(node, visit);
    }
    visit(source);

    const comments = claimComments(code, source);
    const claims = [];
    const skipped = [];
    const replacements = [];
    const claimBinding = unusedClaimBinding(identifiers);

    for (const [index, comment] of comments.entries()) {
        const parsed = parseExpectedClaim(comment.expected);
        if (parsed.status === 'skip') {
            skipped.push({ ...comment, reason: parsed.reason });
            continue;
        }

        const target = precedingTarget(targets, code, comment.start);
        if (target === null) {
            skipped.push({ ...comment, reason: 'not attached to an executable expression' });
            continue;
        }
        const context = contextSensitiveExpression(target.expression);
        if (context !== null) {
            skipped.push({
                ...comment,
                reason: `${context} expression needs its original context`,
            });
            continue;
        }
        if (ambient) {
            skipped.push({ ...comment, reason: 'snippet needs an ambient runtime value' });
            continue;
        }

        const id = `${idPrefix}:${index}`;
        const start = target.expression.getStart(source);
        const end = target.expression.end;
        const expression = code.slice(start, end);
        replacements.push({
            start,
            end,
            text: `${claimBinding}(() => (${expression}), ${JSON.stringify(id)})`,
        });
        claims.push({ id, line: comment.line, expected: comment.expected, spec: parsed.spec });
    }

    let transformed = code;
    for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
        transformed =
            transformed.slice(0, replacement.start) +
            replacement.text +
            transformed.slice(replacement.end);
    }
    if (claims.length > 0) {
        // Indirect eval resolves in the real global environment, so a snippet-level
        // `globalThis` binding cannot redirect this capture. The fresh local name cannot
        // be shadowed anywhere in the original AST, and captures the immutable hook
        // before the snippet can rebind the globalThis property itself.
        transformed =
            `const ${claimBinding} = (0, eval)('globalThis').__almanacExampleClaim;\n` +
            transformed;
    }

    return { code: transformed, claims, skipped, ambient };
}

function unusedClaimBinding(identifiers) {
    const base = '__almanacCapturedExampleClaim';
    let suffix = '';
    while (identifiers.has(`${base}${suffix}`)) {
        suffix = suffix === '' ? 1 : suffix + 1;
    }
    return `${base}${suffix}`;
}

/**
 * Parse the documented value after a `// ->` marker.
 *
 * @param {string} expected - The raw text after the marker.
 * @returns {{ status: 'match', spec: object } | { status: 'skip', reason: string }}
 */
export function parseExpectedClaim(expected) {
    let text = expected.trim();
    if (text === '') return { status: 'skip', reason: 'empty value claim' };

    let approximate = false;
    if (text.startsWith('≈')) {
        approximate = true;
        text = text.slice(1).trimStart();
    } else if (/^approximately\s+/i.test(text)) {
        approximate = true;
        text = text.replace(/^approximately\s+/i, '');
    }

    const prefix = literalPrefix(text);
    if (prefix === null) return { status: 'skip', reason: 'prose or unsupported expected value' };

    let rawSuffix = text.slice(prefix.end);
    const suffix = rawSuffix.trim();
    let decimalPrefix = false;
    if (suffix.startsWith('…')) {
        decimalPrefix = true;
        rawSuffix = suffix.slice(1);
    } else if (suffix.startsWith('...')) {
        decimalPrefix = true;
        rawSuffix = suffix.slice(3);
    }

    if (!allowedAnnotation(rawSuffix, prefix.kind)) {
        return { status: 'skip', reason: 'ambiguous text after expected value' };
    }

    if (prefix.kind === 'string' && /(?:\.\.\.|…)/.test(prefix.value)) {
        return { status: 'skip', reason: 'abbreviated string value' };
    }

    if (prefix.kind === 'number') {
        if (!Number.isFinite(prefix.value)) {
            return {
                status: 'match',
                spec: { kind: 'number-special', value: String(prefix.value) },
            };
        }
        if (decimalPrefix) {
            if (decimalPlacesIn(prefix.text) === null) {
                return { status: 'skip', reason: 'ellipsis needs a decimal prefix' };
            }
            return {
                status: 'match',
                spec: { kind: 'number-prefix', prefix: prefix.text },
            };
        }
        const decimalPlaces = decimalPlacesIn(prefix.text);
        if (approximate || decimalPlaces !== null) {
            return {
                status: 'match',
                spec: {
                    kind: 'number-rounded',
                    value: prefix.value,
                    text: prefix.text,
                    decimalPlaces: decimalPlaces ?? 0,
                },
            };
        }
        return { status: 'match', spec: exactNumberSpec(prefix.value) };
    }

    if (decimalPrefix) {
        return { status: 'skip', reason: 'ellipsis is supported only for decimal values' };
    }
    return { status: 'match', spec: prefix.spec };
}

function claimComments(code, source) {
    const scanner = ts.createScanner(
        ts.ScriptTarget.Latest,
        false,
        ts.LanguageVariant.Standard,
        code,
    );
    const comments = [];
    for (
        let token = scanner.scan();
        token !== ts.SyntaxKind.EndOfFileToken;
        token = scanner.scan()
    ) {
        if (token !== ts.SyntaxKind.SingleLineCommentTrivia) continue;
        const start = scanner.getTokenPos();
        const end = scanner.getTextPos();
        const match = CLAIM_MARKER.exec(code.slice(start, end));
        if (match === null) continue;
        comments.push({
            start,
            end,
            line: source.getLineAndCharacterOfPosition(start).line + 1,
            expected: match[1].trim(),
        });
    }
    return comments;
}

function precedingTarget(targets, code, commentStart) {
    let best = null;
    for (const target of targets) {
        if (target.statement.end > commentStart) continue;
        const between = code.slice(target.statement.end, commentStart);
        if (!/^[ \t]*(?:\r?\n[ \t]*)?$/.test(between)) continue;
        if (best === null || target.statement.end > best.statement.end) best = target;
    }
    return best;
}

function contextSensitiveExpression(expression) {
    let context = null;

    function visit(node) {
        if (context !== null) return;
        // An await/yield inside its own nested function keeps that function's context
        // when the outer expression is wrapped. Only one belonging to the expression we
        // are moving into a plain arrow would become invalid.
        if (node !== expression && ts.isFunctionLike(node)) return;
        if (node.kind === ts.SyntaxKind.AwaitExpression) {
            context = 'await';
            return;
        }
        if (node.kind === ts.SyntaxKind.YieldExpression) {
            context = 'yield';
            return;
        }
        ts.forEachChild(node, visit);
    }

    if (!ts.isFunctionLike(expression)) visit(expression);
    return context;
}

function literalPrefix(text) {
    const scanner = ts.createScanner(
        ts.ScriptTarget.Latest,
        false,
        ts.LanguageVariant.Standard,
        text,
    );
    let sign = '';
    let token = scanner.scan();
    if (token === ts.SyntaxKind.MinusToken || token === ts.SyntaxKind.PlusToken) {
        sign = token === ts.SyntaxKind.MinusToken ? '-' : '+';
        token = scanner.scan();
    }

    if (token === ts.SyntaxKind.NumericLiteral) {
        const tokenText = scanner.getTokenText();
        const value = Number(`${sign}${tokenText.replaceAll('_', '')}`);
        if (!Number.isFinite(value)) return null;
        return {
            kind: 'number',
            value,
            text: `${sign}${tokenText}`,
            end: scanner.getTextPos(),
        };
    }
    if (token === ts.SyntaxKind.BigIntLiteral) {
        const tokenText = scanner.getTokenText().replaceAll('_', '');
        const unsigned = BigInt(tokenText.slice(0, -1));
        const value = sign === '-' ? -unsigned : unsigned;
        return {
            kind: 'bigint',
            value,
            end: scanner.getTextPos(),
            spec: { kind: 'bigint', value: String(value) },
        };
    }
    if (sign !== '') {
        if (token === ts.SyntaxKind.Identifier && scanner.getTokenText() === 'Infinity') {
            const value = sign === '-' ? -Infinity : Infinity;
            return {
                kind: 'number',
                value,
                text: String(value),
                end: scanner.getTextPos(),
            };
        }
        return null;
    }

    if (
        token === ts.SyntaxKind.StringLiteral ||
        token === ts.SyntaxKind.NoSubstitutionTemplateLiteral
    ) {
        const value = scanner.getTokenValue();
        return {
            kind: 'string',
            value,
            end: scanner.getTextPos(),
            spec: { kind: 'string', value },
        };
    }
    if (token === ts.SyntaxKind.TrueKeyword || token === ts.SyntaxKind.FalseKeyword) {
        const value = token === ts.SyntaxKind.TrueKeyword;
        return {
            kind: 'primitive',
            end: scanner.getTextPos(),
            spec: { kind: 'boolean', value },
        };
    }
    if (token === ts.SyntaxKind.NullKeyword) {
        return { kind: 'primitive', end: scanner.getTextPos(), spec: { kind: 'null' } };
    }
    if (token === ts.SyntaxKind.UndefinedKeyword) {
        return { kind: 'primitive', end: scanner.getTextPos(), spec: { kind: 'undefined' } };
    }
    if (token === ts.SyntaxKind.Identifier) {
        const value = scanner.getTokenText();
        if (value === 'NaN' || value === 'Infinity') {
            return {
                kind: 'number',
                value: Number(value),
                text: value,
                end: scanner.getTextPos(),
            };
        }
        return null;
    }
    if (token !== ts.SyntaxKind.OpenBracketToken && token !== ts.SyntaxKind.OpenBraceToken) {
        return null;
    }

    const end = balancedLiteralEnd(text);
    if (end === null) return null;
    const literal = text.slice(0, end);
    const decoded = decodeCompositeLiteral(literal);
    if (decoded === null) return null;
    return { kind: 'structured', end, spec: decoded };
}

function balancedLiteralEnd(text) {
    const scanner = ts.createScanner(
        ts.ScriptTarget.Latest,
        false,
        ts.LanguageVariant.Standard,
        text,
    );
    const stack = [];
    for (
        let token = scanner.scan();
        token !== ts.SyntaxKind.EndOfFileToken;
        token = scanner.scan()
    ) {
        if (token === ts.SyntaxKind.OpenBracketToken || token === ts.SyntaxKind.OpenBraceToken) {
            stack.push(token);
            continue;
        }
        if (token !== ts.SyntaxKind.CloseBracketToken && token !== ts.SyntaxKind.CloseBraceToken)
            continue;
        const expected =
            token === ts.SyntaxKind.CloseBracketToken
                ? ts.SyntaxKind.OpenBracketToken
                : ts.SyntaxKind.OpenBraceToken;
        if (stack.pop() !== expected) return null;
        if (stack.length === 0) return scanner.getTextPos();
    }
    return null;
}

function decodeCompositeLiteral(literal) {
    const source = ts.createSourceFile(
        'expected.ts',
        `const expected = (${literal});`,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
    );
    if (source.parseDiagnostics.length > 0) return null;
    const statement = source.statements[0];
    if (!ts.isVariableStatement(statement)) return null;
    const initializer = statement.declarationList.declarations[0]?.initializer;
    if (initializer === undefined) return null;
    return decodeLiteralNode(initializer);
}

function decodeLiteralNode(node) {
    if (ts.isParenthesizedExpression(node)) return decodeLiteralNode(node.expression);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        return /(?:\.\.\.|…)/.test(node.text) ? null : { kind: 'string', value: node.text };
    }
    if (ts.isNumericLiteral(node)) {
        const text = node.text.replaceAll('_', '');
        const value = Number(text);
        if (!Number.isFinite(value)) return null;
        const decimalPlaces = decimalPlacesIn(text);
        return decimalPlaces === null
            ? exactNumberSpec(value)
            : { kind: 'number-rounded', value, text, decimalPlaces };
    }
    if (ts.isBigIntLiteral(node)) {
        return { kind: 'bigint', value: node.text.replaceAll('_', '').slice(0, -1) };
    }
    if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) {
        return { kind: 'boolean', value: node.kind === ts.SyntaxKind.TrueKeyword };
    }
    if (node.kind === ts.SyntaxKind.NullKeyword) return { kind: 'null' };
    if (node.kind === ts.SyntaxKind.UndefinedKeyword) return { kind: 'undefined' };
    if (ts.isIdentifier(node)) {
        if (node.text === 'NaN' || node.text === 'Infinity') {
            return { kind: 'number-special', value: node.text };
        }
        return null;
    }
    if (ts.isPrefixUnaryExpression(node)) {
        if (node.operator !== ts.SyntaxKind.MinusToken && node.operator !== ts.SyntaxKind.PlusToken)
            return null;
        const decoded = decodeLiteralNode(node.operand);
        if (decoded?.kind === 'number-exact') {
            const value =
                node.operator === ts.SyntaxKind.MinusToken ? -decoded.value : decoded.value;
            return exactNumberSpec(value);
        }
        if (decoded?.kind === 'number-rounded') {
            const negative = node.operator === ts.SyntaxKind.MinusToken;
            return {
                ...decoded,
                value: negative ? -decoded.value : decoded.value,
                text: `${negative ? '-' : '+'}${decoded.text}`,
            };
        }
        if (decoded?.kind === 'bigint') {
            const value = BigInt(decoded.value);
            return {
                kind: 'bigint',
                value: String(node.operator === ts.SyntaxKind.MinusToken ? -value : value),
            };
        }
        if (decoded?.kind === 'number-special' && decoded.value === 'Infinity') {
            return {
                kind: 'number-special',
                value: node.operator === ts.SyntaxKind.MinusToken ? '-Infinity' : 'Infinity',
            };
        }
        return null;
    }
    if (ts.isArrayLiteralExpression(node)) {
        const items = [];
        for (const element of node.elements) {
            if (ts.isSpreadElement(element) || element.kind === ts.SyntaxKind.OmittedExpression)
                return null;
            const decoded = decodeLiteralNode(element);
            if (decoded === null) return null;
            items.push(decoded);
        }
        return { kind: 'array', items };
    }
    if (ts.isObjectLiteralExpression(node)) {
        const entries = [];
        for (const property of node.properties) {
            if (!ts.isPropertyAssignment(property)) return null;
            const key = propertyName(property.name);
            const value = decodeLiteralNode(property.initializer);
            if (key === null || value === null) return null;
            entries.push([key, value]);
        }
        return { kind: 'object', entries };
    }
    return null;
}

function exactNumberSpec(value) {
    // JSON.stringify normalises -0 to 0. The runtime manifest crosses a JSON boundary,
    // so use the string-backed special-number representation to retain Object.is
    // semantics for scalar and recursively decoded structured claims.
    return Object.is(value, -0)
        ? { kind: 'number-special', value: '-0' }
        : { kind: 'number-exact', value };
}

function propertyName(node) {
    if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
        return node.text;
    }
    return null;
}

function allowedAnnotation(rawSuffix, kind) {
    const suffix = rawSuffix.trim();
    if (suffix === '') return true;
    if (/^[ \t]{2,}\S/.test(rawSuffix)) return !startsLikeLiteral(suffix);
    if (
        suffix.startsWith('(') ||
        suffix.startsWith('—') ||
        suffix.startsWith(';') ||
        suffix.startsWith(':')
    ) {
        return true;
    }
    if (suffix.startsWith(',')) {
        const rest = suffix.slice(1).trimStart();
        return !startsLikeLiteral(rest);
    }
    return kind === 'number' && /^[A-Za-z]/.test(suffix);
}

function startsLikeLiteral(text) {
    return /^(?:[-+]?\d|\[|["'`{]|true\b|false\b|null\b|undefined\b|NaN\b|Infinity\b)/.test(text);
}

function decimalPlacesIn(text) {
    const normalized = text.replaceAll('_', '');
    const match = /^[+-]?\d*\.(\d+)(?:e[+-]?\d+)?$/i.exec(normalized);
    return match === null ? null : match[1].length;
}
