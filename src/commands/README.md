# Commands

This directory contains **command handler implementations** for CassandraLens.

## What Are Commands?

Commands are actions that users can trigger from:
- Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
- Keyboard shortcuts
- Context menus (right-click)
- Buttons in the UI
- Other extensions

## Currently Implemented Commands

### ConnectionCommands
- **File**: `connectionCommands.ts`
- **Purpose**: Handles all connection management operations
- **Dependencies**: ConnectionManager, ConnectionStorage, CassandraClient (for testing), ExtensionUri

#### Commands Implemented:

**`cassandra-lens.addConnection`**
- Opens React-based webview form to create a new connection
- Validates input before saving
- Allows testing connection before saving
- Stores credentials securely
- Optionally connects immediately after saving

**`cassandra-lens.editConnection`**
- Opens webview form pre-filled with existing connection data
- Works from both context menu and command palette
- Updates connection profile while preserving ID and timestamps
- Offers to reconnect if editing the active connection

**`cassandra-lens.connectToConnection`**
- Connects to a specific connection profile
- Works from context menu or shows QuickPick from command palette
- Displays progress notification during connection
- Shows cluster metadata (name, version) on success
- Updates last connected timestamp

**`cassandra-lens.disconnect`**
- Disconnects from the active connection
- Gracefully closes the Cassandra client
- Updates UI to reflect disconnected state

**`cassandra-lens.switchConnection`**
- Shows QuickPick with all saved connections
- Highlights currently active connection
- Connects to selected profile

**`cassandra-lens.deleteConnection`**
- Deletes a connection profile
- Works from context menu or shows QuickPick from command palette
- Shows confirmation dialog before deletion
- Automatically disconnects if deleting the active connection
- Removes credentials from secret storage

**`cassandra-lens.refreshConnections`**
- Refreshes the connections tree view
- Reloads connection list from storage
- Updates connection status indicators

---

### SchemaCommands
- **File**: `schemaCommands.ts`
- **Purpose**: Handles schema-related context menu actions
- **Dependencies**: ConnectionTreeProvider (for refresh), SchemaService (for metadata queries)

#### Commands Implemented:

**`cassandra-lens.copyKeyspaceName`**
- Copies keyspace name to clipboard
- Shows confirmation notification
- Triggered from keyspace context menu

**`cassandra-lens.copyTableName`**
- Copies qualified table name (`keyspace.table`) to clipboard
- Useful for CQL queries
- Triggered from table context menu

**`cassandra-lens.copyColumnName`**
- Copies column name to clipboard
- Triggered from column context menu

**`cassandra-lens.copyColumnPath`**
- Copies full column path (`keyspace.table.column`) to clipboard
- Useful for documentation and debugging
- Triggered from column context menu

**`cassandra-lens.browseTableData`**
- Generates `SELECT * FROM keyspace.table LIMIT 100;` query
- Opens in new untitled document with SQL syntax highlighting
- Ready for Week 3 query execution feature
- Triggered from table context menu

**`cassandra-lens.describeTable`**
- Queries SchemaService for complete table schema
- Displays table structure in markdown format:
  - Partition Keys with descriptions
  - Clustering Keys with descriptions
  - Static Columns
  - Regular Columns
  - Approximate CREATE TABLE statement
- Opens in new document for easy reference
- Triggered from table context menu

**`cassandra-lens.refreshNode`**
- Refreshes a specific schema node (keyspace, table, or column parent)
- Clears appropriate cache level (granular cache clearing)
- Triggered from context menu on any schema item
- More efficient than refreshing entire tree

---

### QueryCommands
- **File**: `queryCommands.ts`
- **Purpose**: Handles CQL query execution and query file management
- **Dependencies**: ConnectionManager (for execution), ConnectionStorage (for @conn directive), ExtensionUri (for webview panel)

#### Commands Implemented:

**`cassandra-lens.executeQuery`**
- Executes CQL queries from the active editor
- **Keybinding**: Ctrl+Enter (Windows/Linux) or Cmd+Enter (Mac)
- **Scope**: Executes selected text if selection exists, otherwise entire file
- **Multi-statement support**: Handles semicolon-separated statements sequentially
- **@conn directive**: Supports `-- @conn MyConnection` to specify connection
- **Connection validation**: Checks for active connection before execution
- **Result display**: Opens QueryResultsPanel webview with results
- **Error handling**: Displays error messages with query context
- **Features**:
  - Tracks execution time for CodeLens display
  - Shows progress notification during execution
  - Supports pagination settings from configuration
  - Handles both read and write queries

**`cassandra-lens.newQuery`**
- Creates a new untitled document with CQL language mode
- Pre-fills with template:
  ```cql
  -- New CQL Query
  -- Press Ctrl+Enter (Cmd+Enter on Mac) to execute

  SELECT * FROM
  ```
- Opens document in editor automatically
- Triggered from Command Palette or custom buttons

**`cassandra-lens.executeStatementAtLine`**
- Executes a specific CQL statement at given line range
- Used by CodeLens "Run" buttons (detailed mode)
- Parameters: uriString, startLine, endLine
- Parses and extracts single statement from range
- Shows results in QueryResultsPanel
- Used for granular statement execution

## Command Registration

Commands are registered in `extension.ts` during activation:

```typescript
// Example: Register add connection command
context.subscriptions.push(
  vscode.commands.registerCommand('cassandra-lens.addConnection', () =>
    connectionCommands.addConnection()
  )
);

// Example: Register edit connection with TreeItem extraction
context.subscriptions.push(
  vscode.commands.registerCommand(
    'cassandra-lens.editConnection',
    async (treeItem: any) => {
      let connection = treeItem?.connection || treeItem;

      // Show QuickPick if called from command palette
      if (!connection) {
        const connections = await connectionStorage.loadConnections();
        // ... show picker
      }

      connectionCommands.editConnection(connection);
    }
  )
);

// Example: Register schema command (from context menu)
context.subscriptions.push(
  vscode.commands.registerCommand(
    'cassandra-lens.copyTableName',
    (item) => schemaCommands.copyTableName(item)
  )
);
```

## Best Practices

- **Keep handlers thin**: Delegate business logic to services
- **Handle errors gracefully**: Show user-friendly error messages with vscode.window.showErrorMessage
- **Provide feedback**: Use progress indicators for long operations (vscode.window.withProgress)
- **Validate input**: Check for required state (active connection, etc.) before proceeding
- **Dual-mode support**: Commands should work from both context menus (with arguments) and command palette (without arguments)
- **Clipboard operations**: Always show confirmation after copying to clipboard
- **Schema context**: Commands operating on schema items receive TreeItem objects with keyspace/table/column info

## Command Naming Convention

Follow VS Code conventions:
- Format: `{extensionName}.{action}{Target}`
- Use camelCase for action and target
- Examples:
  - `cassandra-lens.addConnection` ✓
  - `cassandra-lens.copyKeyspaceName` ✓
  - `cassandra-lens.connection-add` ✗ (use camelCase, not kebab-case)

## Context Menu Organization

Schema commands are organized in context menu groups:

**Keyspace context menu:**
- Group `clipboard`: Copy Name
- Group `actions`: Refresh

**Table context menu:**
- Group `actions`: Browse Data, Describe Table, Refresh
- Group `clipboard`: Copy Name

**Column context menu:**
- Group `clipboard`: Copy Name, Copy Path

## Future Enhancements

Future command handlers may include:
- **DDL Commands** - Create/drop keyspaces, tables, indexes
- **QueryCommands** - New query, execute, format, export results
- **TemplateCommands** - Save/load/manage query templates
- **DevToolCommands** - Generate token range queries, analyze partition keys
- **DataCommands** - Insert, update, delete rows from data browser
