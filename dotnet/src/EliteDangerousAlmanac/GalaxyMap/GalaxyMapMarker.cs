namespace EliteDangerousAlmanac.GalaxyMap;

/// <summary>One galaxy-map location marker and the two colours the game draws it in.</summary>
/// <remarks>
/// Both colours are uppercase seven-character <c>#RRGGBB</c> strings, so a caller can hand
/// either straight to a colour parser, a brush or a stylesheet.
/// </remarks>
/// <remarks>
/// The marker's vector asset paints with <c>currentColor</c> under a root <c>color</c>
/// attribute holding <see cref="Color"/>, so a host that embeds the file inline recolours
/// it with one CSS <c>color</c> declaration. The frame of a marker whose
/// <see cref="FrameColor"/> differs is the one part that declaration does not reach.
/// </remarks>
/// <param name="Symbol">
/// The marker's stable identifier, in lower-case kebab case, such as <c>front-line</c>.
/// It is also the base name of the marker's vector asset,
/// <c>assets/galaxy-map/&lt;symbol&gt;.svg</c>.
/// </param>
/// <param name="Color">
/// The glyph's colour. This is the marker's primary colour: the one a caller uses to tint
/// an icon, draw a legend swatch or colour a map pin.
/// </param>
/// <param name="FrameColor">
/// The square border's colour. It matches <paramref name="Color"/> on every marker but
/// <c>front-line</c>, which the game frames in a darker purple than its arrow. It is
/// always present, so a caller never has to fall back to <paramref name="Color"/>.
/// </param>
public sealed record GalaxyMapMarker(string Symbol, string Color, string FrameColor);
