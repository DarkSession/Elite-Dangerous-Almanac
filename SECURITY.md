# Security policy

## Supported versions

Security fixes are made on the latest code on `main`. Once package releases begin, only
the latest published version is supported; older commits and pre-1.0 versions are not
maintained as separate support lines.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub's private
vulnerability reporting for this repository:

<https://github.com/DarkSession/Elite-Dangerous-Almanac/security/advisories/new>

Include the affected API or workflow, a minimal reproduction, the impact and any
suggested mitigation. Remove commander names, account identifiers, credentials and
unrelated personal data from captures and logs.

The maintainers aim to acknowledge a report within seven days. The report will be
investigated in private, and a fix and disclosure will be coordinated according to its
severity. If a report is not a security issue, it may be redirected to the public issue
tracker after sensitive details are removed.

## Scope

Security reports can cover the published npm package, build and release automation,
dependency or provenance weaknesses, and handling of untrusted journal or SLEF input.
Ordinary correctness bugs and public data gaps belong in the issue tracker.
