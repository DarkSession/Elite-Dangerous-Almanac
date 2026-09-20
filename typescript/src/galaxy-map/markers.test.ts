import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';

import { GALAXY_MAP_MARKERS, getGalaxyMapMarker, getGalaxyMapMarkerColor } from './markers.js';
import markersFixture from '../../../fixtures/galaxy-map/markers.jsonc' with { type: 'json' };

const MARKER_ASSETS_DIR = new URL('../../../assets/galaxy-map/', import.meta.url);

const MARKER_VIEW_BOX = '0 0 64 64';

/** Every element a marker is allowed to draw with. */
const MARKER_ELEMENTS = new Set([
    'svg',
    'title',
    'defs',
    'mask',
    'filter',
    'feGaussianBlur',
    'g',
    'use',
    'path',
    'rect',
    'circle',
    'ellipse',
]);

/** Every attribute a marker is allowed to carry. */
const MARKER_ATTRIBUTES = new Set([
    'xmlns',
    'viewBox',
    'width',
    'height',
    'role',
    'id',
    'href',
    'transform',
    'color',
    'fill',
    'fill-rule',
    'stroke',
    'stroke-width',
    'stroke-linejoin',
    'stroke-opacity',
    'opacity',
    'mask',
    'filter',
    'stdDeviation',
    'd',
    'x',
    'y',
    'cx',
    'cy',
    'r',
    'rx',
    'ry',
]);

/** Every element that paints a shape on the canvas. */
const DRAWN_ELEMENTS = new Set(['path', 'rect', 'circle', 'ellipse', 'use']);

/** The attributes that say what a shape paints with. */
const PAINT_ATTRIBUTES = new Set(['fill', 'stroke', 'color']);

/** What a shape paints with when it carries no colour of its own. */
const NOT_A_COLOUR = new Set(['currentColor', 'none']);

interface OpenElement {
    /** The element's tag name. */
    readonly name: string;
    /** The fill it paints with, its own or the one it inherits. */
    readonly fill: string | undefined;
    /** Whether a `<mask>` holds it, where a colour reads as luminance. */
    readonly masked: boolean;
    /** Whether it is a definition, which paints only where a `<use>` draws it. */
    readonly defined: boolean;
}

interface MarkerMarkup {
    /** Every literal colour the markup paints with. */
    readonly paints: readonly Paint[];
    /** The frame's own attributes. */
    readonly frame: ReadonlyMap<string, string>;
}

interface Paint {
    /** The attribute the colour sits on. */
    readonly attribute: string;
    /** The colour itself. */
    readonly value: string;
    /** Whether a `<mask>` holds the shape, where a colour reads as luminance. */
    readonly masked: boolean;
    /** Whether the root `<svg>` carries it. */
    readonly root: boolean;
    /** Whether the square frame carries it. */
    readonly frame: boolean;
}

/**
 * Reads one marker, and refuses any markup outside the small set the markers need.
 *
 * @remarks
 * An allow-list is what makes the paint checks below hold. A scan for colour values
 * misses a `style` attribute, a `<style>` element and a `<filter>`'s `flood-color`,
 * each of which paints. Refusing every element and attribute the markers do not use
 * turns all three into a failure.
 */
function readMarker(svg: string, asset: string): MarkerMarkup {
    assert.doesNotMatch(svg, /<\?|<!/, `${asset} has an unsupported XML construct`);

    const paints: Paint[] = [];
    const open: OpenElement[] = [];
    const maskedIds = new Set<string>();
    const declaredFill = new Map<string, string | undefined>();
    let frameAttributes: ReadonlyMap<string, string> | undefined;
    let offset = 0;

    for (const tag of svg.matchAll(/<(\/?)([A-Za-z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g)) {
        const parent = open.at(-1);
        assert.match(
            svg.slice(offset, tag.index),
            parent?.name === 'title' ? /^[^<>]*$/ : /^\s*$/,
            `${asset} has text outside a title`,
        );
        offset = tag.index + tag[0].length;

        const [, closing, name = '', rawAttributes = '', selfClosing] = tag;
        assert.ok(MARKER_ELEMENTS.has(name), `${asset} draws with <${name}>`);
        if (closing) {
            assert.equal(open.pop()?.name, name, `${asset} has mismatched tags`);
            continue;
        }

        const written = [...rawAttributes.matchAll(/\s([\w:-]+)="([^"]*)"/g)].map(
            ([, attribute = '', value = '']) => [attribute, value] as const,
        );
        const attributes = new Map(written);
        assert.deepEqual(
            [...attributes.keys()],
            written.map(([attribute]) => attribute),
            `${asset} repeats an attribute`,
        );
        // The frame is the first `<rect>` the root draws, which every marker opens with.
        const root = parent === undefined;
        const frame = parent?.name === 'svg' && name === 'rect' && frameAttributes === undefined;
        if (frame) frameAttributes = attributes;

        for (const [attribute, value] of attributes) {
            assert.ok(MARKER_ATTRIBUTES.has(attribute), `${asset} carries ${attribute}`);
            if (attribute === 'href') {
                assert.match(value, /^#[\w-]+$/, `${asset} reaches outside itself`);
            }
            if (attribute === 'mask' || attribute === 'filter') {
                assert.match(value, /^url\(#[\w-]+\)$/, `${asset} reaches outside itself`);
            }
            if (PAINT_ATTRIBUTES.has(attribute) && !NOT_A_COLOUR.has(value)) {
                paints.push({
                    attribute,
                    value,
                    masked: parent?.masked === true || name === 'mask',
                    root,
                    frame,
                });
            }
        }

        // A `<use>` paints with the fill its target sets, and falls back to the fill at
        // the place it draws.
        const href = attributes.get('href')?.replace('#', '');
        const target = href === undefined ? undefined : declaredFill.get(href);
        const element: OpenElement = {
            name,
            fill: target ?? attributes.get('fill') ?? parent?.fill,
            masked: name === 'mask' || parent?.masked === true,
            defined: name === 'defs' || name === 'mask' || parent?.defined === true,
        };

        // A shape with no fill of its own and no ancestor to inherit one from paints
        // in the SVG default, which is black. That is a marker that has lost its
        // colour, so it is recorded as the colour it paints. A `<use>` reads the fill
        // its target's own element carries, so put a definition's fill there or on the
        // `<use>`, never on the definition's children alone.
        if (DRAWN_ELEMENTS.has(name) && element.fill === undefined && !element.defined) {
            paints.push({
                attribute: 'fill',
                value: 'black',
                masked: element.masked,
                root: false,
                frame,
            });
        }

        // A definition inside a `<mask>` reads as luminance only while it stays there.
        const id = attributes.get('id');
        if (id !== undefined) {
            declaredFill.set(id, element.fill);
            if (element.masked) maskedIds.add(id);
        }
        if (href !== undefined && !element.masked) {
            assert.ok(!maskedIds.has(href), `${asset} draws a masked definition on the canvas`);
        }

        if (!selfClosing) open.push(element);
    }

    assert.match(svg.slice(offset), /^\s*$/, `${asset} has trailing markup`);
    assert.deepEqual(open, [], `${asset} has unclosed tags`);
    assert.notEqual(frameAttributes, undefined, `${asset} draws no frame`);
    return { paints, frame: frameAttributes ?? new Map() };
}

/** Reads one marker's asset. */
async function readAsset(symbol: string): Promise<string> {
    return readFile(new URL(`${symbol}.svg`, MARKER_ASSETS_DIR), 'utf8');
}

test('the catalogue holds the pinned number of markers', () => {
    assert.equal(GALAXY_MAP_MARKERS.length, markersFixture.count);
});

test('every marker matches the shared fixture, in the same order', () => {
    assert.deepEqual(
        GALAXY_MAP_MARKERS.map(({ symbol, color, frameColor }) => ({
            symbol,
            color,
            frameColor,
        })),
        markersFixture.records,
    );
});

test('the catalogue is sorted by symbol', () => {
    const symbols = GALAXY_MAP_MARKERS.map((marker) => marker.symbol);
    assert.deepEqual(symbols, [...symbols].sort());
});

test('symbols are unique', () => {
    const symbols = GALAXY_MAP_MARKERS.map((marker) => marker.symbol);
    assert.equal(new Set(symbols).size, symbols.length);
});

test('the palette is the pinned set of distinct colours', () => {
    const colors = [...new Set(GALAXY_MAP_MARKERS.map((marker) => marker.color))].sort();
    assert.deepEqual(colors, markersFixture.distinctColors);
});

test('only the pinned markers are framed in a second colour', () => {
    const framed = GALAXY_MAP_MARKERS.filter((marker) => marker.frameColor !== marker.color).map(
        (marker) => marker.symbol,
    );
    assert.deepEqual(framed, markersFixture.framedDifferently);
});

for (const record of markersFixture.records) {
    test(`getGalaxyMapMarker finds ${record.symbol}`, () => {
        assert.deepEqual(getGalaxyMapMarker(record.symbol), record);
    });
}

test('lookups accept any casing and surrounding whitespace', () => {
    assert.equal(getGalaxyMapMarker('  FRONT-LINE ')?.symbol, 'front-line');
    assert.equal(getGalaxyMapMarkerColor('Titan'), '#FF0000');
});

test('an unrecognised symbol is a miss, not a failure', () => {
    for (const symbol of ['no-such-marker', '', null, undefined]) {
        assert.equal(getGalaxyMapMarker(symbol as unknown as string), null, `${symbol}`);
        assert.equal(getGalaxyMapMarkerColor(symbol as unknown as string), null, `${symbol}`);
    }
});

test('a non-string symbol is rejected, and the error names the call', () => {
    assert.throws(() => getGalaxyMapMarker(7 as unknown as string), {
        name: 'TypeError',
        message: /^getGalaxyMapMarker: symbol/,
    });
    assert.throws(() => getGalaxyMapMarkerColor(7 as unknown as string), {
        name: 'TypeError',
        message: /^getGalaxyMapMarkerColor: symbol/,
    });
});

test('every colour is an uppercase #RRGGBB string', () => {
    for (const marker of GALAXY_MAP_MARKERS) {
        assert.match(marker.color, /^#[0-9A-F]{6}$/, marker.symbol);
        assert.match(marker.frameColor, /^#[0-9A-F]{6}$/, marker.symbol);
    }
});

test('the asset directory holds exactly one SVG per marker', async () => {
    const files = (await readdir(MARKER_ASSETS_DIR)).filter((name) => name.endsWith('.svg'));
    assert.deepEqual(
        files.sort(),
        GALAXY_MAP_MARKERS.map((marker) => `${marker.symbol}.svg`),
    );
});

test('an asset draws with nothing but the markup a marker needs', async () => {
    for (const marker of GALAXY_MAP_MARKERS) {
        readMarker(await readAsset(marker.symbol), marker.symbol);
    }
});

test('an asset paints in no colour the catalogue does not report', async () => {
    for (const marker of GALAXY_MAP_MARKERS) {
        const svg = await readAsset(marker.symbol);
        for (const paint of readMarker(svg, marker.symbol).paints) {
            if (paint.masked) continue;

            // The root carries the marker's own colour, and every shape reaches it
            // through `currentColor`. A `color` below the root shadows it for that
            // subtree, which a CSS declaration on the root then cannot reach.
            assert.notEqual(
                paint.value,
                'black',
                `${marker.symbol} paints with the SVG default: put a definition's fill on ` +
                    'its root element or on the <use> that draws it',
            );

            if (paint.attribute === 'color') {
                assert.ok(paint.root, `${marker.symbol} sets color below the root`);
                assert.equal(paint.value, marker.color, marker.symbol);
                continue;
            }

            // So the one literal a shape may carry is the frame of a marker the game
            // frames in a second colour. Any other literal is a colour no CSS `color`
            // declaration reaches.
            assert.notEqual(
                marker.frameColor,
                marker.color,
                `${marker.symbol} hard-codes ${paint.value}`,
            );
            assert.ok(paint.frame, `${marker.symbol} hard-codes ${paint.value} off the frame`);
            assert.equal(paint.value, marker.frameColor, marker.symbol);
        }
    }
});

test('a mask paints in black and white, which are luminance and not colour', async () => {
    for (const marker of GALAXY_MAP_MARKERS) {
        const svg = await readAsset(marker.symbol);
        for (const paint of readMarker(svg, marker.symbol).paints) {
            if (!paint.masked) continue;

            assert.ok(
                paint.value === '#fff' || paint.value === '#000',
                `${marker.symbol} masks with ${paint.value}`,
            );
        }
    }
});

test('every asset holds one title on the canvas the markers share', async () => {
    for (const marker of GALAXY_MAP_MARKERS) {
        const svg = await readAsset(marker.symbol);
        assert.equal((svg.match(/<title>/g) ?? []).length, 1, marker.symbol);
        assert.match(svg, /<title>[^<]+<\/title>/, `${marker.symbol} has an empty title`);
        assert.match(svg, /<svg[^>]*\srole="img"/, marker.symbol);
        const drawn = svg.match(/<(?:path|rect|circle|ellipse|use)\b/g) ?? [];
        assert.ok(drawn.length > 1, `${marker.symbol} draws nothing inside its frame`);
        assert.match(svg, new RegExp(`<svg[^>]*\\sviewBox="${MARKER_VIEW_BOX}"`), marker.symbol);
    }
});

test('no two assets share a definition id, so a page can inline them all', async () => {
    const seen = new Map<string, string>();
    for (const marker of GALAXY_MAP_MARKERS) {
        const svg = await readAsset(marker.symbol);
        for (const [, id = ''] of svg.matchAll(/\sid="([^"]+)"/g)) {
            assert.equal(seen.get(id), undefined, `${marker.symbol} repeats ${id}`);
            seen.set(id, marker.symbol);
        }
    }
});

test('each asset paints in the colour the catalogue reports', async () => {
    for (const marker of GALAXY_MAP_MARKERS) {
        const svg = await readAsset(marker.symbol);
        assert.match(svg, new RegExp(`<svg[^>]*\\scolor="${marker.color}"`), marker.symbol);

        const { frame } = readMarker(svg, marker.symbol);
        const expectedStroke =
            marker.frameColor === marker.color ? 'currentColor' : marker.frameColor;
        assert.equal(frame.get('stroke'), expectedStroke, marker.symbol);
        assert.equal(frame.get('fill'), 'none', marker.symbol);
    }
});
