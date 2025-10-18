# Security Policy

## Reporting a Vulnerability

We take the security of CassandraLens seriously. If you discover a security vulnerability, please report it responsibly.

---

## How to Report

**⚠️ Do NOT create a public GitHub issue for security vulnerabilities.**

Instead, please report security vulnerabilities through one of these channels:

### Option 1: GitHub Security Advisories (Preferred)

1. Go to https://github.com/gnana997/cassandra-lens/security/advisories
2. Click "Report a vulnerability"
3. Fill out the form with as much detail as possible

### Option 2: Private Email

If you prefer private disclosure, email the security details to:

**Email:** gnana097@gmail.com

---

## What to Include in Your Report

A good security report should include:

1. **Description of the vulnerability**
   - What type of vulnerability is it? (e.g., credential leakage, code injection)
   - What component is affected?

2. **Steps to reproduce**
   - Clear, step-by-step instructions to reproduce the issue
   - Include configuration settings, code snippets, or screenshots if helpful

3. **Potential impact**
   - What could an attacker do with this vulnerability?
   - What data or systems are at risk?

4. **Suggested fix** (optional)
   - If you have ideas on how to fix it, we'd love to hear them!

5. **Your name/handle** (optional)
   - For acknowledgment in release notes
   - You can report anonymously if you prefer

---

## Response Timeline

We are committed to responding quickly and transparently:

- **Initial Response**: Within **3 business days**
- **Status Update**: Within **7 days** with assessment and timeline
- **Fix Timeline**: Depends on severity:
  - **Critical**: Within **7-14 days**
  - **High**: Within **30 days**
  - **Medium/Low**: Within **90 days**

We will keep you informed throughout the process.

---

## Disclosure Policy

We follow **responsible disclosure** principles:

1. **Private Report**: You report the vulnerability privately to us
2. **Investigation**: We investigate and develop a fix
3. **Patch Release**: We release a patched version
4. **Public Disclosure**: Full details are published after users have had time to update (typically 7-14 days after patch release)
5. **Credit**: We credit you in the release notes (unless you request anonymity)

**Coordinated Disclosure Timeline:**
- We typically aim for a **90-day** disclosure deadline from initial report
- If you have a different preference, let us know and we'll work with you

---

## What Qualifies as a Security Issue?

Examples of security vulnerabilities we want to know about:

### High Priority
- **Credential Leakage**: Passwords or secrets exposed in logs, files, or UI
- **Remote Code Execution**: Ability to execute arbitrary code
- **CQL Injection**: Ability to inject malicious CQL queries
- **Authentication Bypass**: Connecting without proper credentials
- **Privilege Escalation**: Gaining unauthorized access to clusters or data
- **Data Exposure**: Sensitive data visible to unauthorized users

### Medium Priority
- **Path Traversal**: Reading files outside expected directories
- **Denial of Service**: Crashes or hangs affecting availability
- **Insecure Dependencies**: Vulnerable npm packages (with known exploits)
- **Information Disclosure**: Leaking version info, cluster topology, etc.

---

## Out of Scope

The following are generally **NOT** considered security issues:

- **Physical Access Required**: Vulnerabilities requiring physical access to the user's machine
- **Social Engineering**: Attacks relying on tricking users
- **Dependency Issues**: Vulnerabilities in upstream dependencies (report to the dependency maintainers instead)
- **Feature Requests**: Suggestions for security-related features (use GitHub Issues)
- **Configuration Issues**: User misconfiguration (unless defaults are insecure)

If you're unsure whether something qualifies, err on the side of reporting it!

---

## Legal Safe Harbor

We commit to:

- **Not pursue legal action** against researchers who:
  - Report vulnerabilities in good faith
  - Follow this disclosure policy
  - Make reasonable efforts to avoid privacy violations, data destruction, and service disruption

- **Consider good-faith security research** as authorized conduct under applicable computer fraud and abuse laws

- **Work with you** to understand and resolve the issue quickly

---

## Security Best Practices for Users

Help keep your data secure:

### Connection Security
- ✅ Use strong passwords for Cassandra authentication
- ✅ Enable SSL/TLS for production connections
- ✅ Review connection settings before connecting to production clusters
- ✅ Use separate connections for development and production

### Credential Management
- ✅ Never commit connection profiles with passwords to version control
- ✅ Use `.gitignore` to exclude `.vscode/settings.json` if it contains connection profiles
- ✅ Regularly rotate Cassandra passwords
- ✅ Use VS Code Secret Storage (we store credentials securely by default)

### Extension Updates
- ✅ Keep CassandraLens updated to the latest version
- ✅ Review release notes for security-related fixes
- ✅ Enable auto-updates in VS Code settings

### Network Security
- ✅ Use firewall rules to restrict Cassandra port (9042) access
- ✅ Connect over VPN when accessing remote clusters
- ✅ Verify cluster contact points before connecting

---

## Security Features in CassandraLens

We've built security into the extension:

- ✅ **Secure Credential Storage**: Passwords stored in VS Code Secret Storage API (encrypted at rest)
- ✅ **No Password Logging**: Credentials never appear in logs or debug output
- ✅ **Privacy-First Tracking**: Feedback system tracks only counts, never query content or connection details
- ✅ **SSL/TLS Support**: Connect to clusters with SSL encryption
- ✅ **Connection Warnings**: Alerts when switching connections via @conn directive
- ✅ **No Telemetry**: We don't collect usage data or send information to external servers

---

## Acknowledgments

We thank the following researchers for responsibly disclosing security issues:

<!-- Security researchers will be listed here as vulnerabilities are reported and fixed -->

---

## Contact

For non-security issues, please use:
- **Bugs**: [GitHub Issues](https://github.com/gnana997/cassandra-lens/issues)
- **Questions**: [GitHub Discussions](https://github.com/gnana997/cassandra-lens/discussions)

For security issues only, use the reporting methods described above.

---

Thank you for helping keep CassandraLens and our users safe! 🔒
