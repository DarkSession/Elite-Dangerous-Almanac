import assert from 'node:assert/strict';
import { open, readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';

import { SHIPS } from './ships.js';
import { enumerateSlots } from './slots.js';

const SHIP_ASSETS_DIR = new URL('../../../assets/ships/', import.meta.url);
const SHIP_ASSET_FILENAMES = [
    'illustration.svg',
    'schematic-bottom.svg',
    'schematic-top.svg',
] as const;
const SCHEMATIC_SIDES = ['top', 'bottom'] as const;
const FEATURE_CATEGORIES = new Set([
    'canopy',
    'cargo_hatch',
    'engine',
    'fighter_bay',
    'hardpoint',
    'heat_vent',
    'landing_gear',
    'thruster',
    'utility_mount',
]);
const SAFE_SCHEMATIC_ELEMENTS = new Set(['svg', 'g', 'path', 'circle']);
const SAFE_SCHEMATIC_ATTRIBUTES = new Set([
    'color',
    'cx',
    'cy',
    'd',
    'data-endpoint-extension',
    'data-feature',
    'data-feature-category',
    'data-feature-color',
    'data-journal-slot',
    'data-junction-gap',
    'data-junction-repairs',
    'data-model-socket',
    'data-path-assembly',
    'data-technical-layer',
    'data-technical-line',
    'data-visible',
    'fill',
    'fill-opacity',
    'fill-rule',
    'height',
    'id',
    'inkscape:groupmode',
    'inkscape:label',
    'r',
    'stroke',
    'stroke-linecap',
    'stroke-linejoin',
    'stroke-width',
    'viewBox',
    'width',
    'xmlns',
    'xmlns:inkscape',
]);

interface SvgElement {
    readonly name: string;
    readonly attributes: ReadonlyMap<string, string>;
}

function svgElements(source: string, asset: string): readonly SvgElement[] {
    const content = source.replace(/^<\?xml version="1\.0" encoding="UTF-8"\?>\s*/, '');
    assert.notEqual(content, source, `${asset} has an unexpected XML declaration`);
    assert.doesNotMatch(content, /<\?|<!/, `${asset} has an unsupported XML construct`);

    const elements: SvgElement[] = [];
    const openElements: string[] = [];
    const tags = content.matchAll(
        /<(\/?)([A-Za-z][\w:-]*)((?:\s+[\w:-]+\s*=\s*"[^"]*")*)\s*(\/?)>/g,
    );
    let offset = 0;

    for (const match of tags) {
        assert.match(
            content.slice(offset, match.index),
            /^\s*$/,
            `${asset} has unsupported markup syntax`,
        );
        offset = (match.index ?? 0) + match[0].length;

        const closing = match[1] as string;
        const name = match[2] as string;
        const rawAttributes = match[3] as string;
        const selfClosing = match[4] as string;
        if (closing) {
            assert.equal(rawAttributes, '', `${asset} has attributes on a closing tag`);
            assert.equal(selfClosing, '', `${asset} has an invalid closing tag`);
            assert.equal(openElements.pop(), name, `${asset} has mismatched element tags`);
            continue;
        }

        const attributes = new Map(
            [...rawAttributes.matchAll(/\s([\w:-]+)\s*=\s*"([^"]*)"/g)].map(
                (attribute) => [attribute[1] as string, attribute[2] as string] as const,
            ),
        );
        const assignedNames = [...rawAttributes.matchAll(/\s([\w:-]+)\s*=/g)].map(
            (attribute) => attribute[1] as string,
        );
        const unconsumed = rawAttributes.replace(/\s[\w:-]+\s*=\s*"[^"]*"/g, '').trim();
        assert.match(unconsumed, /^\/?$/, `${asset} has unsupported start-tag syntax`);
        assert.equal(
            attributes.size,
            assignedNames.length,
            `${asset} has an unsupported attribute syntax`,
        );
        assert.deepEqual([...attributes.keys()], assignedNames, `${asset} repeats an attribute`);
        for (const [name, value] of attributes) {
            assert.doesNotMatch(value, /[<>]/, `${asset} contains an unsupported attribute value`);
            if (name === 'fill' || name === 'stroke' || name === 'color') {
                assert.match(
                    value,
                    /^(?:#[\dA-Fa-f]{6}|currentColor|none)$/,
                    `${asset} contains an unsafe paint value`,
                );
            }
        }
        elements.push({ name, attributes });
        if (!selfClosing) openElements.push(name);
    }

    assert.match(content.slice(offset), /^\s*$/, `${asset} has unsupported markup syntax`);
    assert.deepEqual(openElements, [], `${asset} has unclosed element tags`);
    return elements;
}

test('schematic parsing rejects active XML constructs', () => {
    const declaration = '<?xml version="1.0" encoding="UTF-8"?>';
    for (const active of [
        '<?xml-stylesheet href="https://example.invalid/schematic.css"?>',
        '<!DOCTYPE svg SYSTEM "https://example.invalid/schematic.dtd">',
    ]) {
        assert.throws(
            () => svgElements(`${declaration}${active}<svg></svg>`, 'active.svg'),
            /unsupported XML construct/,
        );
    }
    assert.throws(
        () => svgElements(`${declaration}<svg/onload="alert(1)"></svg>`, 'active.svg'),
        /unsupported markup syntax/,
    );
    assert.throws(
        () => svgElements(`${declaration}<svg><path onload="alert(1)" d="<"/></svg>`, 'active.svg'),
        /unsupported attribute value/,
    );
    for (const paint of [
        '&#117;rl(https://example.invalid/paint.svg)',
        'u\\72l(https://example.invalid/paint.svg)',
    ]) {
        assert.throws(
            () => svgElements(`${declaration}<svg fill="${paint}"></svg>`, 'active.svg'),
            /unsafe paint value/,
        );
    }
});

test('the README publishes the exact schematic feature categories', async () => {
    const readme = await readFile(new URL('../../README.md', import.meta.url), 'utf8');
    const categoryList = readme.match(/current categories are\s+([\s\S]*?)\.\n/)?.[1];
    assert.ok(categoryList, 'README is missing the schematic feature categories');
    const documented = [...categoryList.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
    assert.deepEqual(documented.sort(), [...FEATURE_CATEGORIES].sort());
});

test('ship illustrations and schematics follow the catalogue symbols one for one', async () => {
    const entries = await readdir(SHIP_ASSETS_DIR, { withFileTypes: true });
    const assetSymbols = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
    const catalogueSymbols = SHIPS.map((ship) => ship.symbol).sort();

    assert.deepEqual(assetSymbols, catalogueSymbols);

    for (const symbol of catalogueSymbols) {
        const shipDirectory = new URL(`${symbol}/`, SHIP_ASSETS_DIR);
        assert.deepEqual((await readdir(shipDirectory)).sort(), SHIP_ASSET_FILENAMES, symbol);

        for (const filename of SHIP_ASSET_FILENAMES) {
            const asset = await open(new URL(filename, shipDirectory));
            try {
                const { size } = await asset.stat();
                assert.ok(size > 0, `${symbol}/${filename} is empty`);

                const prefix = Buffer.alloc(Math.min(size, 256));
                await asset.read(prefix, 0, prefix.length, 0);
                assert.match(
                    prefix.toString(),
                    /<svg[^>]+viewBox="0 0 1200 800"/,
                    `${symbol}/${filename} has an unexpected SVG canvas`,
                );

                const suffix = Buffer.alloc(Math.min(size, 256));
                await asset.read(suffix, 0, suffix.length, size - suffix.length);
                assert.match(
                    suffix.toString(),
                    /<\/svg>\s*$/,
                    `${symbol}/${filename} is incomplete`,
                );
            } finally {
                await asset.close();
            }
        }
    }
});

test('ship schematics expose complete, passive slot annotations', async () => {
    for (const ship of SHIPS) {
        const expectedSlots = new Map(
            enumerateSlots(ship)
                .filter((slot) => slot.kind === 'hardpoint' || slot.kind === 'utility')
                .map((slot) => [
                    slot.key,
                    slot.kind === 'hardpoint' ? 'hardpoint' : 'utility_mount',
                ]),
        );
        const observedSlots = new Map<string, Set<string>>();

        for (const side of SCHEMATIC_SIDES) {
            const asset = `${ship.symbol}/schematic-${side}.svg`;
            const source = await readFile(new URL(asset, SHIP_ASSETS_DIR), 'utf8');
            const elements = svgElements(source, asset);
            const sideSlots = new Set<string>();

            for (const element of elements) {
                assert.ok(
                    SAFE_SCHEMATIC_ELEMENTS.has(element.name),
                    `${asset} contains active or foreign <${element.name}> content`,
                );
                for (const [name, value] of element.attributes) {
                    assert.ok(
                        SAFE_SCHEMATIC_ATTRIBUTES.has(name),
                        `${asset} contains unsupported ${name} content`,
                    );
                    assert.doesNotMatch(value, /url\s*\(/i, `${asset} contains a URL reference`);
                }

                const feature = element.attributes.get('data-feature');
                const journalSlot = element.attributes.get('data-journal-slot');
                if (feature === undefined) {
                    assert.equal(journalSlot, undefined, `${asset} has an unclassified slot`);
                    continue;
                }
                assert.equal(element.name, 'g', `${asset} annotates a non-group feature`);
                assert.ok(FEATURE_CATEGORIES.has(feature), `${asset} has feature ${feature}`);

                if (feature !== 'hardpoint' && feature !== 'utility_mount') {
                    assert.equal(
                        journalSlot,
                        undefined,
                        `${asset} gives ${feature} a journal slot`,
                    );
                    continue;
                }

                assert.ok(journalSlot, `${asset} has a ${feature} without a journal slot`);
                assert.equal(expectedSlots.get(journalSlot), feature, `${asset}: ${journalSlot}`);
                assert.equal(sideSlots.has(journalSlot), false, `${asset} repeats ${journalSlot}`);
                sideSlots.add(journalSlot);

                const sides = observedSlots.get(journalSlot) ?? new Set<string>();
                sides.add(side);
                observedSlots.set(journalSlot, sides);
            }
        }

        assert.deepEqual(
            [...observedSlots.keys()].sort(),
            [...expectedSlots.keys()].sort(),
            `${ship.symbol} schematic slots do not match its hull layout`,
        );
    }
});
