using System.ComponentModel;

namespace System.Runtime.CompilerServices;

/// <summary>
/// Marks an <c>init</c> accessor for a compiler that targets .NET Standard 2.1, whose
/// base class library does not declare the type itself.
/// </summary>
[EditorBrowsable(EditorBrowsableState.Never)]
internal static class IsExternalInit
{
}
