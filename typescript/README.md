# @elite-dangerous-almanac/core

Tree-shakeable Elite Dangerous static data and calculations for TypeScript and
JavaScript applications.

## Install

```bash
npm install @elite-dangerous-almanac/core
```

The package is ESM-only. Browser bundlers may import the complete astro feature
barrel:

```ts
import { StarSystem } from '@elite-dangerous-almanac/core/astro';
```

Native ESM applications can avoid evaluating unrelated data modules by importing
a leaf entry:

```ts
import { StarSystem } from '@elite-dangerous-almanac/core/astro/star-system';
import { massCodeToSizeClass } from '@elite-dangerous-almanac/core/astro/mass-code';
```

`StarSystem` converts procedural names and 64-bit system addresses:

```ts
const system = StarSystem.fromName('Synuefe EN-H d11-96');
system?.systemAddress; // 3309179996515n

StarSystem.fromSystemAddress(3309179996515n).name;
// 'Synuefe EN-H d11-96'
```

See the repository README and generated GitHub Wiki for the complete API guide.
Third-party data and algorithm credits are included in
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

## License

MIT. See [LICENSE](./LICENSE).
