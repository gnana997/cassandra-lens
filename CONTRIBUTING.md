# Contributing to CassandraLens

Thank you for your interest in contributing to CassandraLens! This document outlines how to contribute to the project.

---

## Ways to Contribute

We welcome contributions in many forms:

- 🐛 **Report Bugs** - Found a bug? Let us know via GitHub Issues
- 💡 **Suggest Features** - Have an idea? Share it in GitHub Issues or Discussions
- 📖 **Improve Documentation** - Help make our docs clearer and more comprehensive
- 🔧 **Submit Code Changes** - Fix bugs or implement features via Pull Requests
- ⭐ **Share Feedback** - Tell us about your experience using CassandraLens

---

## Reporting Bugs

Before reporting a bug:

1. **Search existing issues** to see if it's already been reported
2. **Update to latest version** to confirm the bug still exists
3. **Test with a clean VS Code profile** to rule out conflicts

When reporting a bug:

1. Go to [GitHub Issues](https://github.com/gnana997/cassandra-lens/issues/new)
2. Click "New Issue" and choose "Bug Report" template
3. Fill out all required fields:
   - VS Code version (`Help` → `About`)
   - CassandraLens version (from Extensions view)
   - Cassandra version you're connecting to
   - Operating system
4. Include:
   - **Steps to reproduce** (be specific!)
   - **Expected behavior** vs **actual behavior**
   - **Screenshots** or **error messages** if applicable
   - **Relevant configuration** from `settings.json`

---

## Requesting Features

Before requesting a feature:

1. Check if it's already requested in [GitHub Issues](https://github.com/gnana997/cassandra-lens/issues)
2. Search [GitHub Discussions](https://github.com/gnana997/cassandra-lens/discussions) for related conversations

When requesting a feature:

1. Go to [GitHub Issues](https://github.com/gnana997/cassandra-lens/issues/new)
2. Choose "Feature Request" template
3. Explain:
   - **What problem does this solve?** (the "why")
   - **How would it work?** (your proposed solution)
   - **Are there alternatives?** (other approaches you've considered)
4. Add screenshots, mockups, or examples from other tools if helpful

---

## Contributing Code

### Development Setup

**Prerequisites:**
- Node.js 22.x or higher
- VS Code 1.105.0 or higher
- Git
- Access to a Cassandra cluster (for testing)

**Fork and Clone:**

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/YOUR-USERNAME/cassandra-lens.git
cd cassandra-lens/cassandra-lens-vs-ext
```

**Install Dependencies:**

```bash
npm install
```

**Development Workflow:**

```bash
# Compile TypeScript and watch for changes
npm run watch

# In VS Code, press F5 to launch Extension Development Host
# The extension will automatically reload on file changes
```

**Test Your Changes:**

1. Connect to a Cassandra cluster in the Extension Development Host
2. Test all affected functionality
3. Verify no TypeScript errors: `npm run compile`
4. Run linter: `npm run lint`

---

### Pull Request Process

**1. Create a Feature Branch:**

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

**Branch Naming:**
- Features: `feature/add-query-export`
- Bug fixes: `fix/connection-timeout`
- Docs: `docs/update-readme`

**2. Make Your Changes:**

- Write clean, readable code
- Follow existing patterns and conventions
- Add JSDoc comments for public APIs
- Keep commits focused and atomic

**3. Commit Your Changes:**

```bash
git add .
git commit -m "feat: add CSV export for query results"
```

**Commit Message Format:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only
- `refactor:` Code refactoring (no functional changes)
- `perf:` Performance improvement
- `test:` Adding tests
- `chore:` Build/tooling changes

**4. Push to Your Fork:**

```bash
git push origin feature/your-feature-name
```

**5. Open a Pull Request:**

1. Go to the [original repository](https://github.com/gnana997/cassandra-lens)
2. Click "New Pull Request"
3. Select your fork and branch
4. Fill out the PR template completely
5. Link related issues (e.g., "Fixes #123")

**6. Code Review:**

- Wait for maintainer review (usually within 3-5 days)
- Address feedback and make requested changes
- Push new commits to your branch (PR will update automatically)
- Once approved, your PR will be merged!

---

### Code Style Guidelines

**TypeScript:**
- Use TypeScript strict mode features
- Prefer `const` over `let`, avoid `var`
- Use meaningful variable names (`connectionProfile`, not `cp`)
- Add JSDoc comments for public methods and classes

**Example:**

```typescript
/**
 * Connects to a Cassandra cluster with the given connection profile.
 *
 * @param profile - The connection profile containing cluster details
 * @returns Cluster metadata including name and version
 * @throws {Error} If connection fails or times out
 */
async connect(profile: ConnectionProfile): Promise<ClusterMetadata> {
  // Implementation
}
```

**Formatting:**
- Use 2 spaces for indentation
- Use single quotes for strings
- Add trailing commas in multi-line objects/arrays
- Run `npm run lint` before committing

**File Organization:**
- Group imports: external packages → internal modules → types
- Keep files focused (one class/concept per file)
- Use descriptive file names (`connectionManager.ts`, not `mgr.ts`)

---

### Testing

**Manual Testing:**

1. Press F5 to launch Extension Development Host
2. Test your changes with:
   - Different Cassandra versions (3.11, 4.0, 4.1)
   - Various scenarios (fresh install, existing connections, etc.)
   - Edge cases (empty results, errors, timeouts)

**What to Test:**
- Connection management (add, edit, delete, connect, disconnect)
- Query execution (single statement, multi-statement, selection, @conn)
- Schema browsing (expand/collapse, refresh, copy operations)
- CodeLens display (different modes, connection switches)

---

## Questions or Need Help?

- **Questions:** Ask in [GitHub Discussions](https://github.com/gnana997/cassandra-lens/discussions/categories/q-a)
- **Ideas:** Share in [GitHub Discussions](https://github.com/gnana997/cassandra-lens/discussions/categories/ideas)
- **Bugs:** Report in [GitHub Issues](https://github.com/gnana997/cassandra-lens/issues)

---

## Code of Conduct

Please be respectful and constructive in all interactions. We're building a welcoming community for Cassandra developers.

---

## License

By contributing to CassandraLens, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

Thank you for contributing to CassandraLens! 🎉

Every contribution, no matter how small, makes a difference. Whether you're fixing a typo, reporting a bug, or implementing a major feature, we appreciate your help in making CassandraLens better for the entire Cassandra community.
