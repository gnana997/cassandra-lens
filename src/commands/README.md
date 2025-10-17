# Commands

This directory contains **command handler implementations** for CassandraLens.

## What Are Commands?

Commands are actions that users can trigger from:
- Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
- Keyboard shortcuts
- Context menus (right-click)
- Buttons in the UI
- Other extensions

## Commands in CassandraLens

### Connection Commands
- **File**: `connectionCommands.ts`
- **Commands**:
  - `cassandra-lens.addConnection` - Opens connection form
  - `cassandra-lens.switchConnection` - Shows connection picker
  - `cassandra-lens.testConnection` - Tests connection before saving
  - `cassandra-lens.deleteConnection` - Removes saved connection
  - `cassandra-lens.editConnection` - Edits existing connection

### Schema Commands
- **File**: `schemaCommands.ts`
- **Commands**:
  - `cassandra-lens.refreshSchema` - Reloads schema tree
  - `cassandra-lens.copyTableName` - Copies qualified table name
  - `cassandra-lens.describeTable` - Shows table schema details
  - `cassandra-lens.browseTableData` - Opens query editor with SELECT

### Query Commands
- **File**: `queryCommands.ts`
- **Commands**:
  - `cassandra-lens.newQuery` - Opens new query editor
  - `cassandra-lens.executeQuery` - Runs current query (Ctrl+Enter)
  - `cassandra-lens.formatQuery` - Formats CQL with proper indentation
  - `cassandra-lens.exportResults` - Exports to CSV/JSON
  - `cassandra-lens.showQueryHistory` - Opens query history panel

### Template Commands
- **File**: `templateCommands.ts`
- **Commands**:
  - `cassandra-lens.saveAsTemplate` - Saves query as template
  - `cassandra-lens.insertTemplate` - Inserts template into editor
  - `cassandra-lens.manageTemplates` - Opens template library

### Developer Tool Commands
- **File**: `devToolCommands.ts`
- **Commands**:
  - `cassandra-lens.generateTokenRangeQuery` - Creates parallel queries
  - `cassandra-lens.analyzePartitionKey` - Checks query partition key usage
  - `cassandra-lens.showClusterStatus` - Displays cluster info

## Command Registration

Commands are registered in `extension.ts` during activation:

```typescript
// Example: Register a command
context.subscriptions.push(
  vscode.commands.registerCommand('cassandra-lens.addConnection', async () => {
    const handler = new ConnectionCommands(connectionManager, connectionStorage);
    await handler.addConnection();
  })
);
```

## Best Practices

- **Keep handlers thin**: Delegate business logic to services
- **Handle errors gracefully**: Show user-friendly error messages
- **Provide feedback**: Use progress indicators for long operations
- **Validate input**: Check for required state (active connection, etc.)

## Command Naming Convention

Follow VS Code conventions:
- Format: `{extensionName}.{action}{Target}`
- Examples:
  - `cassandra-lens.addConnection` ✓
  - `cassandra-lens.connection-add` ✗ (use camelCase, not kebab-case)
