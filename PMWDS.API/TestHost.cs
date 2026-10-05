namespace PMWDS.API;

/// <summary>
/// Marker type that lets PMWDS.Tests host this application with
/// <c>WebApplicationFactory&lt;TestHost&gt;</c>.
/// </summary>
/// <remarks>
/// The obvious approach - <c>WebApplicationFactory&lt;Program&gt;</c> against the class the
/// top-level statements generate - does not work here, because PMWDS.AI also uses top-level
/// statements and therefore also emits a global <c>Program</c>. Referencing it is ambiguous
/// (CS0433). <c>WebApplicationFactory&lt;T&gt;</c> only needs a type whose assembly contains
/// the entry point, so this namespaced marker avoids the collision entirely.
/// </remarks>
public sealed class TestHost
{
    private TestHost() { }
}
