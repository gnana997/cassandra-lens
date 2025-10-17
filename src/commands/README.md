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
```

## Best Practices

- **Keep handlers thin**: Delegate business logic to services
- **Handle errors gracefully**: Show user-friendly error messages with vscode.window.showErrorMessage
- **Provide feedback**: Use progress indicators for long operations (vscode.window.withProgress)
- **Validate input**: Check for required state (active connection, etc.) before proceeding
- **Dual-mode support**: Commands should work from both context menus (with arguments) and command palette (without arguments)

## Command Naming Convention

Follow VS Code conventions:
- Format: `{extensionName}.{action}{Target}`
- Use camelCase for action and target
- Examples:
  - `cassandra-lens.addConnection` ✓
  - `cassandra-lens.connection-add` ✗ (use camelCase, not kebab-case)

## Future Enhancements

Future command handlers may include:
- **SchemaCommands** - Create/drop keyspaces, tables, indexes
- **QueryCommands** - New query, execute, format, export results
- **TemplateCommands** - Save/load/manage query templates
- **DevToolCommands** - Generate token range queries, analyze partition keys
