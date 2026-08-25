"""
BOOT.05 tests a literal policy string, not a policy property. Make it test the property.

The assertion required this exact text inside script-src:

    'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com

so removing those two hosts - which makes the policy STRICTER, permitting no external host at all -
fails a test written to keep the policy strict. That is a stale expectation, the same shape as the
suite saving a .docx under a .doc name and then failing it for not being HTML.

Everything the assertion was genuinely protecting is kept and still checked:
default-src 'none', base-uri 'none', form-action 'none', no 'unsafe-eval', no wildcard, and an
inline app script permitted. What changes is the host clause: instead of demanding two specific
hosts be present, it now demands that **every** http(s) host appearing anywhere in the policy is on
a pinned allowlist. Zero hosts passes. The two current hosts pass. A third host fails, which is what
the check was for.

This is a test-only change. It touches no application file.

Usage: python refresh_boot05_csp_contract.py <path-to-run_regression_suite.js>
"""
import io, os, sys, hashlib

path = sys.argv[1] if len(sys.argv) > 1 else r"C:\Claude\SIREN\codex\qa\run_regression_suite.js"
s = io.open(path, encoding="utf-8").read()
print("input  SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())

OLD = """    const cspPass = /default-src\\s+'none'/.test(csp || '') &&
      /script-src\\s+'self'\\s+'unsafe-inline'\\s+https:\\/\\/cdn\\.jsdelivr\\.net\\s+https:\\/\\/unpkg\\.com/.test(csp || '') &&
      /base-uri\\s+'none'/.test(csp || '') && /form-action\\s+'none'/.test(csp || '') &&
      !/'unsafe-eval'|\\*/.test(csp || '');
    suite.check(scenario, cspPass,
      "default-deny CSP with inline app script, pinned Mermaid hosts, and no unsafe-eval/wildcard", csp,
      'meta[http-equiv="Content-Security-Policy"]');"""

NEW = """    // The host clause is an allowlist test, not a literal one. Requiring the two CDN hosts to be
    // PRESENT failed any policy that removed them - that is, any policy stricter than the one this
    // was written against. What matters is that no host outside the pinned set is ever permitted;
    // permitting none at all satisfies that most strongly.
    const CSP_PINNED_HOSTS = ['https://cdn.jsdelivr.net', 'https://unpkg.com'];
    const cspHosts = (csp || '').match(/https?:\\/\\/[^\\s;']+/g) || [];
    const strayHosts = cspHosts.filter(h => !CSP_PINNED_HOSTS.includes(h));
    const cspPass = /default-src\\s+'none'/.test(csp || '') &&
      /script-src\\s+'self'\\s+'unsafe-inline'/.test(csp || '') &&
      /base-uri\\s+'none'/.test(csp || '') && /form-action\\s+'none'/.test(csp || '') &&
      !/'unsafe-eval'|\\*/.test(csp || '') &&
      strayHosts.length === 0;
    suite.check(scenario, cspPass,
      "default-deny CSP, inline app script, no unsafe-eval or wildcard, and no host outside the pinned set",
      strayHosts.length ? 'unpinned host(s): ' + strayHosts.join(', ') + ' | ' + csp : csp,
      'meta[http-equiv="Content-Security-Policy"]');"""

n = s.count(OLD)
assert n == 1, "expected 1 occurrence of the BOOT.05 CSP assertion, found %d" % n
s = s.replace(OLD, NEW)
print("  applied: BOOT.05 host clause is now an allowlist, not a literal")

tmp = path + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, path)
print("output SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())
