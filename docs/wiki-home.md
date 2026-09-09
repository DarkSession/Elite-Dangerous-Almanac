# Elite Dangerous Almanac

Static Elite Dangerous data and calculations for community applications and research —
procedural system names and `id64` addresses, galactic regions and nebulae, ships and
outfitting with build metrics, personal equipment and engineering materials, localized
display text, and market commodities.

The same data and the same behaviour are published for two languages. Pick the one you
are writing in; each has its own guides, its own reference and its own navigation.

## [TypeScript](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/TypeScript)

```bash
npm install @elite-dangerous-almanac/core
```

ESM-only, Node.js 22+ and modern browser bundlers, every module side-effect free.

```ts
import { ProceduralSystem } from '@elite-dangerous-almanac/core/astro/procedural-system';

ProceduralSystem.fromName('Synuefe EN-H d11-96')?.systemAddress; // -> 3309179996515n
```

**[Open the TypeScript wiki](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/TypeScript)**
— install, guides, and the complete API reference.

## [.NET](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet)

```bash
dotnet pack src/EliteDangerousAlmanac/EliteDangerousAlmanac.csproj --configuration Release
```

.NET Standard 2.1, so .NET 10, .NET Core 3.0 and above, and Mono 6.4 and above. The
package is not on NuGet yet, so it is built from the repository.

```csharp
using EliteDangerousAlmanac.Astronomy;

ProceduralSystem? system = ProceduralSystem.FromName("Synuefai XU-M d8-79");
ulong address = system!.SystemAddress;
```

**[Open the .NET wiki](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet)**
— install, guides, and the complete API reference.

## The six feature areas

Both packages carry all six. Each one is a TypeScript subpath and a .NET namespace.

| Area | TypeScript | .NET | Provides |
| --- | --- | --- | --- |
| Astronomy | `astro` | `Astronomy` | Procedural system names, `id64` addresses, sectors, galactic regions, nebulae, permit locks, scanned-body physics |
| Ships | `ships` | `Ships` | Hulls, modules, loadouts, SLEF, engineering, jump range, power, shields, armour, weapons |
| Equipment | `equipment` | `Equipment` | Odyssey suits, handheld weapons, grade upgrades, engineer modifications, journal suit loadouts |
| Localization | `i18n` | `Localization` | Sparse localized module, blueprint, effect, material, micro-resource, commodity and personal-equipment display text |
| Materials | `materials` | `Materials` | Ship engineering materials and Odyssey micro resources |
| Commodities | `commodities` | `Commodities` | Standard and rare market commodities |

The two packages do not carry the same names: each is written the way its own language
reads. What they share is the behaviour, which the fixtures under `fixtures/` prove for
each of them.

## Licensing

The bundled game and community data has source-specific licensing, including
non-commercial terms. Review
[LICENSE](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/LICENSE) and
[ATTRIBUTIONS.md](https://github.com/DarkSession/Elite-Dangerous-Almanac/blob/main/ATTRIBUTIONS.md)
before redistribution or commercial use.
