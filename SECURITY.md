# Security Policy

## Reporting a Vulnerability

Please report security vulnerabilities **privately**. Do not open a public issue,
pull request or Discord message for a suspected vulnerability, as that discloses it
to everyone before a fix exists.

Use **[GitHub private vulnerability reporting](https://github.com/shumaiOne/shumai/security/advisories/new)**
(the "Report a vulnerability" button on the Security tab). If that is unavailable,
contact the maintainer directly rather than in a public channel.

Please include:

- What the issue is, and the impact you believe it has
- The version or commit you tested (`git rev-parse HEAD`, or the image digest)
- Steps to reproduce, ideally minimal
- Your deployment shape: storage backend, whether the agent feature is enabled,
  and whether the instance is internet-reachable

## Supported Versions

Shumai is pre-1.0 and moves quickly. Security fixes are made against the **latest
release**. Users are encouraged to track releases rather than pin indefinitely.

## Scope

**In scope** — the application, its API, the shipped Docker images, and the
deployment manifests under `docker-compose/`.

Deployment manifests are explicitly in scope. A default that is unsafe when
followed as documented is a real finding, because the documented quickstart is what
most operators actually run.

**Out of scope**

- Vulnerabilities in third-party dependencies, unless Shumai's use of them is what
  creates the exposure. Report those upstream.
- Findings that require an already-compromised host or database.
- Configurations that deviate from the documented deployment.

## Operator guidance

Shumai is self-hosted, so several controls belong to the operator rather than to the
project:

- **Set `BETTER_AUTH_SECRET` per deployment.** It signs sessions and, in local
  storage mode, upload URLs. Never reuse a value from documentation or an example.
- **Do not expose the instance to the public internet without a reverse proxy**
  terminating TLS and applying your own access policy.
- **Do not publish the database port.** Set a real database password.
- **Treat the agent feature as a code-execution surface.** If you enable it, run it
  where a compromise is survivable, and review the sandbox network policy.

## Disclosure

Please allow a reasonable period for a fix before public disclosure. The maintainer
will acknowledge reports and keep reporters informed of progress.
