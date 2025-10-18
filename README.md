# CassandraLens

[![Version](https://img.shields.io/visual-studio-marketplace/v/gnana997.cassandra-lens.svg)](https://marketplace.visualstudio.com/items?itemName=gnana997.cassandra-lens)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/gnana997.cassandra-lens.svg)](https://marketplace.visualstudio.com/items?itemName=gnana997.cassandra-lens)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/gnana997.cassandra-lens.svg)](https://marketplace.visualstudio.com/items?itemName=gnana997.cassandra-lens)
[![License](https://img.shields.io/github/license/gnana997/cassandra-lens.svg)](LICENSE)

**Query, explore, and manage Apache Cassandra databases directly from Visual Studio Code.**

<!-- PLACEHOLDER: Hero image showing full VS Code window with query execution -->
<!-- ![CassandraLens Hero](images/hero-demo.gif) -->

> **⚠️ Early Access - Version 0.1.0**: This is the initial public release with core functionality. We're actively developing new features and appreciate your feedback!

---

## Overview

CassandraLens brings powerful Apache Cassandra database management capabilities to VS Code. Execute CQL queries, browse schemas, manage connections, and more—all without leaving your editor.

**Perfect for:**
- Cassandra developers who live in VS Code
- Database administrators managing Cassandra clusters
- Data engineers working with CQL
- Anyone who prefers keyboard-driven database tools

---

## ✨ Features

### 🚀 CQL Query Execution
Execute CQL queries with rich syntax highlighting and inline results.

<!-- PLACEHOLDER: GIF showing query typed, Ctrl+Enter pressed, results appearing -->
<!-- ![Query Execution](images/query-execution.gif) -->

- **Keyboard Shortcut**: `Ctrl+Enter` (Windows/Linux) or `Cmd+Enter` (macOS)
- **Run All Queries**: Execute entire file with `▶ Run All` button
- **Per-Statement Execution**: Click `▶ Run` button on individual statements
- **Execution Time Tracking**: See query performance metrics
- **Result Formats**: View results in table or JSON format
- **Multi-Connection Support**: Use `@conn` directive to target specific clusters

### 📊 Interactive Query Results
View and explore query results in a clean, tabular interface.

<!-- PLACEHOLDER: Screenshot of query results panel showing table data -->
<!-- ![Query Results](images/query-results.png) -->

- **Pagination**: Navigate large result sets with configurable page sizes (100/250/500 rows)
- **Column Metadata**: See data types and column information
- **Copy-Friendly**: Easy selection and copying of result data
- **Execution Metrics**: View row counts and execution times

### 🗂️ Schema Explorer
Browse your Cassandra database structure in an intuitive tree view.

<!-- PLACEHOLDER: Screenshot of sidebar with keyspaces, tables, columns expanded -->
<!-- ![Schema Explorer](images/schema-explorer.png) -->

- **Keyspace Navigation**: Expand keyspaces to view tables and user-defined types
- **Table Inspection**: See all columns with data types and key designations
- **Quick Actions**: Right-click for Browse Data, Describe Table, Copy Name operations
- **System Keyspace Filtering**: Optionally hide system keyspaces
- **Schema Caching**: Fast performance with intelligent caching
- **Refresh on Demand**: Update schema view with a click

### 🔌 Connection Management
Save and manage multiple Cassandra cluster connections.

<!-- PLACEHOLDER: Screenshot of connection dialog/form -->
<!-- ![Connection Manager](images/connection-manager.png) -->

- **Multiple Connections**: Save unlimited connection profiles
- **Secure Password Storage**: Credentials stored in VS Code's secure storage
- **Quick Switching**: Switch between clusters with Command Palette
- **Auto-Connect**: Automatically reconnect to last-used cluster on startup
- **Connection Status**: Visual indicators show active connections
- **Edit & Delete**: Manage saved connections easily

### ⚡ IntelliSense & CodeLens
Smart code assistance for CQL queries.

<!-- PLACEHOLDER: Screenshot of autocomplete dropdown showing CQL keywords -->
<!-- ![IntelliSense](images/intellisense.png) -->

- **Keyword Completion**: Intelligent suggestions for CQL commands
- **Syntax Highlighting**: Full CQL language support
- **CodeLens Buttons**: Inline `▶ Run` buttons in CQL files
- **Connection Indicators**: See which cluster queries will execute against
- **Multi-Connection Warnings**: Alerts when file uses multiple clusters

### 🎯 Advanced Features

**@conn Directive**: Target specific clusters per query
```cql
-- @conn Production-Cluster
SELECT * FROM users WHERE user_id = 123;

-- @conn Staging-Cluster
SELECT * FROM users WHERE user_id = 123;
```

**Context Menu Actions**: Right-click on schema items for:
- Browse Table Data
- Describe Table
- Copy Names/Paths
- Refresh Schema

**Status Bar Integration**: See connection status and query results at a glance

---

## 📦 Installation

### From VS Code Marketplace

1. Open VS Code
2. Press `Ctrl+Shift+X` (Windows/Linux) or `Cmd+Shift+X` (macOS)
3. Search for "CassandraLens"
4. Click **Install**

### From Command Line

```bash
code --install-extension gnana997.cassandra-lens
```

### From VSIX File

1. Download the `.vsix` file from [GitHub Releases](https://github.com/gnana997/cassandra-lens/releases)
2. Open VS Code
3. Press `Ctrl+Shift+P` → `Extensions: Install from VSIX...`
4. Select the downloaded file

---

## 🚀 Quick Start

### 1. Add Your First Connection

<!-- PLACEHOLDER: Screenshot of "Add Connection" button in sidebar -->
<!-- ![Add Connection](images/add-connection-step.png) -->

- Click the **+** icon in the CassandraLens sidebar
- Or run command: `CassandraLens: Add Connection`

### 2. Configure Connection

<!-- PLACEHOLDER: Screenshot of connection form filled out -->
<!-- ![Configure Connection](images/connection-form.png) -->

Enter your cluster details:
- **Name**: "My Cluster"
- **Contact Points**: `localhost` (or your cluster IPs)
- **Port**: `9042` (default CQL port)
- **Local Datacenter**: `datacenter1`
- **Username/Password**: (if authentication enabled)

### 3. Connect

<!-- PLACEHOLDER: Screenshot of connected cluster in sidebar -->
<!-- ![Connected](images/connected-cluster.png) -->

- Click **Save** to create the connection
- Click **Connect** or right-click → **Connect to Connection**

### 4. Browse Schema

<!-- PLACEHOLDER: Screenshot of expanded keyspace showing tables -->
<!-- ![Browse Schema](images/browse-schema.png) -->

- Expand your keyspace in the tree view
- Explore tables and columns

### 5. Run Your First Query

<!-- PLACEHOLDER: Screenshot of CQL query in editor -->
<!-- ![First Query](images/first-query.png) -->

- Create a new `.cql` file or click **New Query**
- Type your CQL query
- Press `Ctrl+Enter` (Windows/Linux) or `Cmd+Enter` (macOS)
- View results in the query results panel!

---

## ⚙️ Configuration

CassandraLens can be customized through VS Code settings. Access via:
- `File` → `Preferences` → `Settings` → Search for "CassandraLens"
- Or edit `settings.json` directly

### Available Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `cassandraLens.connection.autoConnectOnStartup` | `boolean` | `true` | Automatically connect to the most recently used connection when VS Code starts |
| `cassandraLens.schema.filterSystemKeyspaces` | `boolean` | `false` | Hide system keyspaces (system, system_auth, etc.) in the schema tree |
| `cassandraLens.schema.cacheEnabled` | `boolean` | `true` | Enable caching of schema metadata to improve performance |
| `cassandraLens.query.defaultPageSize` | `number` | `100` | Default number of rows to display per page (100, 250, or 500) |
| `cassandraLens.query.completionMessageFormat` | `string` | `"detailed"` | Format of query completion messages: `"minimal"`, `"detailed"`, or `"verbose"` |
| `cassandraLens.query.completionMessageDuration` | `number` | `3000` | Duration (ms) to show completion messages in status bar (1000-10000) |
| `cassandraLens.editor.codeLensMode` | `string` | `"detailed"` | CodeLens display mode: `"off"`, `"minimal"`, `"standard"`, or `"detailed"` |
| `cassandraLens.editor.warnOnConnectionSwitch` | `boolean` | `true` | Show confirmation when @conn directive switches connections |

### Example Configuration

```json
{
  "cassandraLens.connection.autoConnectOnStartup": true,
  "cassandraLens.query.defaultPageSize": 250,
  "cassandraLens.query.completionMessageFormat": "verbose",
  "cassandraLens.editor.codeLensMode": "detailed",
  "cassandraLens.schema.filterSystemKeyspaces": true
}
```

### CodeLens Modes Explained

- **Off**: No CodeLens buttons (use keyboard shortcuts only)
- **Minimal**: `▶ Run All` button and connection indicator at file top
- **Standard**: Minimal + multi-connection warning
- **Detailed**: All above + `▶ Run` buttons on each statement *(Recommended)*

---

## ⌨️ Keyboard Shortcuts & Commands

### Default Keyboard Shortcuts

| Command | Windows/Linux | macOS | Description |
|---------|---------------|-------|-------------|
| Execute Query | `Ctrl+Enter` | `Cmd+Enter` | Run selected query or query at cursor |

### Available Commands

All commands are accessible via Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

**Connection Management:**
- `CassandraLens: Add Connection` - Create a new connection profile
- `CassandraLens: Connect` - Connect to a saved cluster
- `CassandraLens: Switch Connection` - Switch active connection
- `CassandraLens: Disconnect` - Close current connection
- `CassandraLens: Edit Connection` - Modify connection settings
- `CassandraLens: Delete Connection` - Remove saved connection
- `CassandraLens: Refresh Connections` - Reload connection list

**Query Operations:**
- `CassandraLens: Execute Query` - Run current query (`Ctrl+Enter`)
- `CassandraLens: New Query` - Create new CQL editor

**Schema Operations:**
- `CassandraLens: Browse Table Data` - View table contents
- `CassandraLens: Describe Table` - Show table structure
- `CassandraLens: Copy Keyspace Name` - Copy to clipboard
- `CassandraLens: Copy Table Name` - Copy to clipboard
- `CassandraLens: Copy Column Name` - Copy to clipboard
- `CassandraLens: Copy Column Path` - Copy qualified path
- `CassandraLens: Refresh` - Refresh schema node

### Customizing Shortcuts

You can customize keyboard shortcuts:
1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Type "Preferences: Open Keyboard Shortcuts"
3. Search for "CassandraLens"
4. Click the pencil icon to edit

---

## 📋 Requirements

### Minimum Requirements
- **VS Code**: Version 1.105.0 or higher
- **Cassandra**: Apache Cassandra 3.x, 4.x, or DataStax Enterprise
- **Network**: Access to Cassandra cluster on port 9042 (default)

### Supported Cassandra Versions
- Apache Cassandra 3.11.x
- Apache Cassandra 4.0.x
- Apache Cassandra 4.1.x
- DataStax Enterprise 6.8.x
- DataStax Astra (cloud-hosted Cassandra)

---

## 🎯 Current Status - Version 0.1.0

This is the **initial public release** of CassandraLens. Core features are stable and ready for daily use, but we're actively adding new functionality based on community feedback.

### ✅ What Works Now

- ✅ CQL query execution with syntax highlighting
- ✅ Schema browsing (keyspaces, tables, columns, types)
- ✅ Multiple saved connection profiles
- ✅ Secure credential storage
- ✅ Query results in table/JSON format
- ✅ CodeLens inline execution buttons
- ✅ @conn directive for multi-cluster workflows
- ✅ Context menu schema operations
- ✅ Auto-reconnect on startup
- ✅ Execution time tracking
- ✅ Query result export (CSV, JSON)

### 🚧 Known Limitations

- Results limited to 500 rows per page
- No query result export (CSV/JSON) yet
- Limited support for complex UDTs (User-Defined Types)
- No visual query builder
- Schema operations (CREATE/ALTER/DROP) via CQL only

### 🔮 Roadmap - Coming Soon

We're actively working on these features for upcoming releases:

**v0.2.0 (Next Release)**
- [ ] Enhanced error handling and suggestions
- [ ] Query history and favorites
- [ ] Table-level IntelliSense (column completion)
- [ ] Performance improvements for large schemas

**Future Releases**
- [ ] Visual schema designer (CREATE TABLE via UI)
- [ ] Query builder with drag-and-drop
- [ ] Import data from files (CSV, JSON)
- [ ] Multi-cluster monitoring dashboard
- [ ] Advanced UDT support
- [ ] DataStax Astra one-click connect

**Have a feature request?** [Open an issue](https://github.com/gnana997/cassandra-lens/issues) - we'd love to hear from you!

---

## 🐛 Known Issues

### Connection Issues

**"All hosts unreachable" error**
- Ensure Cassandra cluster is running: `nodetool status`
- Verify contact points and port in connection settings
- Check firewall allows port 9042
- Confirm local datacenter name matches your cluster

**"Authentication failed" error**
- Double-check username and password
- Ensure PasswordAuthenticator is enabled in cassandra.yaml
- Try creating a new connection profile

### Query Issues

**"Timeout" errors**
- Increase `cassandraLens.query.queryTimeout` setting
- Add LIMIT clause to large queries
- Check cluster health and load

### General Issues

**Extension not activating**
1. Check Output panel: View → Output → Select "CassandraLens"
2. Look for activation errors
3. Restart VS Code
4. Reinstall extension if needed

**For other issues:** Check [GitHub Issues](https://github.com/gnana997/cassandra-lens/issues) or [open a new issue](https://github.com/gnana997/cassandra-lens/issues/new)

---

## 🤝 Contributing

We welcome contributions! CassandraLens is open source and community-driven.

### Ways to Contribute

- **Report Bugs**: [Open an issue](https://github.com/gnana997/cassandra-lens/issues/new) with details
- **Request Features**: Share your ideas in [GitHub Issues](https://github.com/gnana997/cassandra-lens/issues)
- **Submit Pull Requests**: Fork, code, and submit PRs
- **Improve Documentation**: Help make our docs better
- **Share Feedback**: Let us know how you use CassandraLens!

### Development Setup

```bash
# Clone repository
git clone https://github.com/gnana997/cassandra-lens.git
cd cassandra-lens

# Install dependencies
npm install

# Compile and watch for changes
npm run watch

# Run extension in Extension Development Host
Press F5 in VS Code
```

---

## 💬 Support & Feedback

### Get Help
- **Issues**: [GitHub Issues](https://github.com/gnana997/cassandra-lens/issues)
- **Discussions**: [GitHub Discussions](https://github.com/gnana997/cassandra-lens/discussions)
- **Documentation**: This README and inline help

### Feedback

We're constantly improving CassandraLens. Your feedback helps shape future releases!

- ⭐ **Star the repo** if you find it useful
- 📣 **Share** with other Cassandra developers
- 💡 **Suggest features** via GitHub Issues
- 🐛 **Report bugs** to help us improve

### Share Your Experience

After using CassandraLens, you'll be prompted to share feedback after executing 10 queries. You can also manually share feedback anytime:

- **Command Palette**: `CassandraLens: Send Feedback`
- **Choose from**: Share Feedback, Report Bug, Request Feature, or View Documentation

Your feedback helps us prioritize features and improvements! All tracking is privacy-first—we never see your queries or connection details.

---

## 📄 License

This extension is licensed under the [MIT License](LICENSE).

Copyright (c) 2025 CassandraLens Contributors

---

## 🙏 Acknowledgments

- Built with [cassandra-driver](https://github.com/datastax/nodejs-driver) - DataStax Node.js driver for Apache Cassandra
- Inspired by [SQLTools](https://vscode-sqltools.mteixeira.dev/) and other excellent database extensions
- Icon design inspired by Apache Cassandra logo

---

## 📊 Badges & Stats

[![Version](https://img.shields.io/visual-studio-marketplace/v/gnana997.cassandra-lens.svg)](https://marketplace.visualstudio.com/items?itemName=gnana997.cassandra-lens)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/gnana997.cassandra-lens.svg)](https://marketplace.visualstudio.com/items?itemName=gnana997.cassandra-lens)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/gnana997.cassandra-lens.svg)](https://marketplace.visualstudio.com/items?itemName=gnana997.cassandra-lens)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/gnana997.cassandra-lens.svg)](https://marketplace.visualstudio.com/items?itemName=gnana997.cassandra-lens)
[![GitHub Stars](https://img.shields.io/github/stars/gnana997/cassandra-lens.svg)](https://github.com/gnana997/cassandra-lens)
[![GitHub Issues](https://img.shields.io/github/issues/gnana997/cassandra-lens.svg)](https://github.com/gnana997/cassandra-lens/issues)
[![License](https://img.shields.io/github/license/gnana997/cassandra-lens.svg)](LICENSE)

**Enjoying CassandraLens?** Please consider [leaving a review](https://marketplace.visualstudio.com/items?itemName=gnana997.cassandra-lens&ssr=false#review-details) on the marketplace!

---

<div align="center">

**Made with ❤️ for the Cassandra community**

[Report Bug](https://github.com/gnana997/cassandra-lens/issues) · [Request Feature](https://github.com/gnana997/cassandra-lens/issues) · [View Roadmap](https://github.com/gnana997/cassandra-lens/issues)

</div>
