The goods a market trades.

[CommodityCatalogue](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Commodities.Class.CommodityCatalogue)
holds the standard commodities and the rare ones a single station sells, each a
[Commodity](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Commodities.Record.Commodity)
carrying its Frontier symbol, its display name and its
[CommodityCategory](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Commodities.Enumeration.CommodityCategory).

A lookup takes a name or a symbol in any casing, with any surrounding whitespace, and
answers `null` for one no record carries.
[CommodityCategories](https://github.com/DarkSession/Elite-Dangerous-Almanac/wiki/DotNet.Commodities.Class.CommodityCategories)
reads and writes the in-game spelling of a category, which is what a market panel and a
journal line both use.
