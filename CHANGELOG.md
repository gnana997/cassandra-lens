# Changelog

All notable changes to the "CassandraLens" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2025-01-19

### Added

**Initial Public Release** - Core database management features for Apache Cassandra

#### Query Execution
- CQL query execution with `Ctrl+Enter` (Cmd+Enter on macOS) keyboard shortcut
- Multi-statement execution (semicolon-delimited queries)
- Interactive query results panel with tabular display
- Pagination support with configurable page sizes (100/250/500 rows per page)
- Execution time tracking and performance metrics display
- Query error reporting with detailed error messages
- Selection-based execution (run selected text or entire file)

#### Schema Management
- Schema explorer tree view showing keyspaces, tables, and columns
- Expandable tree hierarchy with lazy loading
- Column metadata display with data types and key designations
- Color-coded column icons (partition keys, clustering keys, static columns, regular columns)
- Schema caching for improved performance
- Optional system keyspace filtering
- Context menu actions: Browse Table Data, Describe Table, Copy Name/Path
- Granular refresh (refresh specific keyspace or table)

#### Connection Management
- Multiple connection profile support (save unlimited connections)
- Secure credential storage using VS Code Secret Storage API
- Connection profiles stored in workspace settings
- Quick connection switching via Command Palette
- Auto-reconnect to last used connection on startup
- Connection status indicators in tree view and status bar
- Test connection before saving
- Edit and delete saved connections
- Support for authentication (PlainTextAuthProvider)
- SSL/TLS configuration support

#### Code Intelligence
- CodeLens inline execution buttons with configurable modes:
  - Off: No CodeLens (keyboard shortcuts only)
  - Minimal: Run All button + connection indicator
  - Standard: Minimal + multi-connection warning
  - Detailed: Standard + per-statement Run buttons
- `@conn` directive for targeting specific connections per query
- Connection indicator showing active cluster
- Multi-connection warning when file uses multiple `@conn` directives
- CQL syntax highlighting with custom language definition

#### User Experience
- User feedback collection system (automatic prompt after 10 queries)
- Manual feedback command (`CassandraLens: Send Feedback`)
- Privacy-first tracking (only counts, no query content or credentials)
- Comprehensive configuration settings for customization
- Status bar integration showing connection status and query results
- Command Palette integration for all operations
- Keyboard shortcut customization support
- New Query command for creating CQL files with templates

#### Configuration
- `cassandraLens.connection.autoConnectOnStartup` - Auto-reconnect on startup
- `cassandraLens.schema.filterSystemKeyspaces` - Hide system keyspaces
- `cassandraLens.schema.cacheEnabled` - Enable schema caching
- `cassandraLens.query.defaultPageSize` - Result pagination size
- `cassandraLens.query.completionMessageFormat` - Status message format
- `cassandraLens.query.completionMessageDuration` - Message display duration
- `cassandraLens.editor.codeLensMode` - CodeLens display mode
- `cassandraLens.editor.warnOnConnectionSwitch` - Warn on @conn switch

#### Developer Experience
- Comprehensive inline documentation for all components
- React-based webviews for connection forms and query results
- TypeScript type definitions for all APIs
- Webpack bundling for optimized extension size
- Source maps for debugging support

### Documentation
- Comprehensive README with feature overview and screenshots placeholders
- Installation instructions for marketplace, CLI, and VSIX
- Quick start guide with step-by-step setup
- Configuration reference with all available settings
- Keyboard shortcuts and commands reference
- Troubleshooting guide for common issues
- Contributing guidelines
- Security policy for responsible disclosure
- Pull request template with quality checklist

### Supported Platforms
- Apache Cassandra 3.11.x
- Apache Cassandra 4.0.x
- Apache Cassandra 4.1.x
- DataStax Enterprise 6.8.x
- DataStax Astra (cloud-hosted Cassandra)

### Requirements
- VS Code 1.105.0 or higher
- Network access to Cassandra cluster (default port 9042)

---

## Future Releases

See [GitHub Issues](https://github.com/gnana997/cassandra-lens/issues) for planned features and roadmap.

[Unreleased]: https://github.com/gnana997/cassandra-lens/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/gnana997/cassandra-lens/releases/tag/v0.1.0
