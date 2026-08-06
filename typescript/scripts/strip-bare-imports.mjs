import { init, parse } from 'es-module-lexer';

await init;

/** Remove static bare-import declarations without touching import-like source text. */
export function stripBareImports(source) {
    const [imports] = parse(source);
    const ranges = imports
        .filter(({ d, ss, se }) => d === -1 && /^import\s*['"]/.test(source.slice(ss, se)))
        .map(({ ss, se }) => [ss, source[se] === ';' ? se + 1 : se]);

    let cleaned = source;
    for (const [start, end] of ranges.reverse()) {
        cleaned = `${cleaned.slice(0, start)}${cleaned.slice(end)}`;
    }
    return cleaned;
}
