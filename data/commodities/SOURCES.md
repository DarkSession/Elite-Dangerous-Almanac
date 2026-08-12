# Data sources — `data/commodities/`

**Acquired:** FDevIDs 2026-07-24 UTC; player-journal record 2026-08-02 UTC; in-game
category verification 2026-08-12 UTC. **Upstream revision:** unavailable. One record
combines the latter two sources, documented under Standard commodities.

## Standard commodities

- **File:** `commodities.jsonc` (257 tradable goods).
- **Source:** EDCD FDevIDs, `commodity.csv` (columns `id,symbol,category,name`).
- **Derivation:** records are carried over in registry order as
  `{ symbol, name, category }`. `symbol` is Frontier's internal id as the market and
  journal report it; `name` is the display name;
  `category` is the market group (Metals, Minerals, Foods, …), kept verbatim including the
  space in multi-word groups (`Consumer Items`, `Industrial Materials`, `Legal Drugs`). The
  CSV's numeric `id` column is dropped — commodities are keyed by `symbol`. The
  `NonMarketable` group (its one member, symbol `Drones`, is Limpets) is retained: a
  registry must resolve every symbol the market can report.
- **One record is not from FDevIDs** (acquired 2026-08-02 UTC) — `curatedcommodity` /
  "Curated Commodity Package". Acquired from a player-journal `MarketBuy` event timestamped
  `2026-08-01T16:12:01Z` (`MarketID` 128667761, `BuyPrice` 347), which supplies the
  `symbol` (`Type`) and `name` (`Type_Localised`) verbatim. A `MarketBuy` carries **no
  category**; `Industrial Materials` is separately observed in the running game's commodity
  market (2026-08-12 UTC; no immutable revision). The record is appended after the registry
  order rather than inserted into it, so FDevIDs order is still recoverable by dropping the
  tail. Standard rather than rare: a `MarketBuy` of 388 units far exceeds any rare's
  per-station allocation. The event's `Count`, `BuyPrice`, `TotalCost` and `MarketID` are
  dropped — this is an id/name/category registry, not a price sheet.

## Rare commodities

- **File:** `rare-commodities.jsonc` (142 location-specific luxury goods).
- **Source:** EDCD FDevIDs, `rare_commodity.csv` (columns
  `id,symbol,market_id,category,name`).
- **Derivation:** records are carried over in registry order as
  `{ symbol, name, category }`, exactly as for standard commodities. Both the numeric `id`
  and the `market_id` columns are dropped: rares are keyed by `symbol`, and the `market_id`
  — the id of the single station that produces a rare — has no stable source referent in
  this data domain. A record's rareness is not stored on it; it is derived from which
  catalogue the record lives in, the same way a material's category is derived from its
  catalogue.
