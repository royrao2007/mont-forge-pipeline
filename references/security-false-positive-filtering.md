# False-positive filtering

Give this file in full to every per-candidate false-positive check. Its job is to decide, for one
candidate vulnerability, whether it survives — and to assign it a confidence score.

Decide from the code. Do not run commands to reproduce the vulnerability, and do not write files.

## Hard exclusions

Automatically exclude a finding that matches any of these patterns:

1. Denial of service (DOS) vulnerabilities or resource exhaustion attacks.
2. Secrets or credentials stored on disk if they are otherwise secured.
3. Rate limiting concerns or service overload scenarios.
4. Memory consumption or CPU exhaustion issues.
5. Lack of input validation on non-security-critical fields without proven security impact.
6. Input sanitization concerns for CI workflow definitions (for example GitHub Action workflows) unless
   they are clearly triggerable via untrusted input.
7. A lack of hardening measures. Code is not expected to implement every security best practice; only
   concrete vulnerabilities are in scope.
8. Race conditions or timing attacks that are theoretical rather than practical. Report a race
   condition only when it is concretely problematic.
9. Vulnerabilities related to outdated third-party libraries. Those are managed separately.
10. Memory safety issues such as buffer overflows or use-after-free. These are impossible in Rust, and
    should not be reported for Rust or any other memory-safe language.
11. Files that are only unit tests or only used as part of running tests.
12. Log spoofing concerns. Writing unsanitized user input to logs is not a vulnerability.
13. SSRF that only controls the path. SSRF matters only when it can control the host or the protocol.
14. Including user-controlled content in an AI system prompt is not a vulnerability.
15. Regex injection. Injecting untrusted content into a regular expression is not a vulnerability.
16. Regex DOS concerns.
17. Insecure documentation. Do not report findings in documentation files such as markdown files.
18. A lack of audit logs is not a vulnerability.

In addition, exclude any finding that is only a finding in a markdown documentation file, and any
memory-safety finding in a file that is not C or C++ (`.c`, `.cc`, `.cpp`, `.h`) — including files with
no extension.

## Precedents

These override a naive reading of a rule. Apply them before scoring:

1. Logging high-value secrets in plaintext is a vulnerability. Logging URLs is assumed to be safe.
2. UUIDs can be assumed to be unguessable and do not need to be validated.
3. Environment variables and CLI flags are trusted values. An attacker generally cannot modify them in
   a secure environment, so any attack that relies on controlling an environment variable is invalid.
4. Resource management issues such as memory or file descriptor leaks are not valid.
5. Subtle or low-impact web vulnerabilities — tabnabbing, XS-Leaks, prototype pollution, open redirects
   — should not be reported unless they are extremely high confidence.
6. React and Angular are generally secure against XSS. These frameworks do not need to sanitize or
   escape user input unless the code uses `dangerouslySetInnerHTML`, `bypassSecurityTrustHtml`, or a
   similar unsafe escape hatch. Do not report XSS in React or Angular components, or in `.tsx` files,
   unless such a method is in use.
7. Most vulnerabilities in CI workflow definitions are not exploitable in practice. Before accepting
   one, make sure it is concrete and has a very specific attack path.
8. A lack of permission checking or authentication in client-side JavaScript or TypeScript is not a
   vulnerability. Client-side code is not trusted and does not need those checks; the server side is
   responsible for validating and sanitizing all inputs. The same applies to every flow that sends
   untrusted data to a backend.
9. Only include MEDIUM findings when they are obvious and concrete issues.
10. Most vulnerabilities in notebooks (`*.ipynb`) are not exploitable in practice. Before accepting
    one, make sure it is concrete and has a very specific attack path in which untrusted input can
    trigger it.
11. Logging non-PII data is not a vulnerability even if the data may be sensitive. Report a logging
    finding only when it exposes secrets, passwords, or personally identifiable information.
12. Command injection in shell scripts is generally not exploitable in practice, because shell scripts
    generally do not run with untrusted user input. Report it only when it is concrete and has a very
    specific attack path for untrusted input.

## Signal quality criteria

For each candidate that survived the exclusions, answer:

1. Is there a concrete, exploitable vulnerability with a clear attack path?
2. Does this represent a real security risk, or theoretical best practice?
3. Are there specific code locations and reproduction steps?
4. Would this finding be actionable for a security team?

If any answer is no, the candidate should not survive.

## Confidence scoring

Assign every surviving candidate a confidence score from 1 to 10:

- **1-3** — Low confidence. Likely false positive or noise.
- **4-6** — Medium confidence. Needs investigation.
- **7-10** — High confidence. Likely a true vulnerability.

**The gate is 8.** A candidate scoring below 8 is dropped from the report. A candidate scoring 8 or
above is reported. Report the score with the finding.

This bar is equivalent to requiring better than 80% confidence that the issue is genuinely
exploitable.

## How to report the filter's decision

For one candidate, return:

- `keep` — whether it survives
- `confidence_score` — 1-10
- `justification` — why, in one or two sentences
- `exclusion_reason` — when it does not survive, which exclusion or precedent applied

If the filter cannot be run at all, do not silently promote the finding. Say that the filter did not
run, and report the candidate separately as unverified rather than as a confirmed finding.
