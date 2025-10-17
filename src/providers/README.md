# Providers

This directory contains **VS Code Provider implementations** for CassandraLens.

## What Are Providers?

Providers are classes that implement VS Code interfaces to supply data and functionality to the editor. They act as bridges between your extension logic and VS Code's UI.

## Currently Implemented Providers

### ConnectionTreeProvider
- **File**: `connectionTreeProvider.ts`
- **Purpose**: Powers the Connections sidebar tree view
- **Shows**: List of saved connection profiles with connection status indicators
- **Features**:
  - Displays connection name and contact points
  - Shows connection state (connected/disconnected) with visual indicators
  - Automatically refreshes when connection state changes
  - Provides context menu actions (Connect, Disconnect, Edit, Delete)
- **Reference**: [VS Code TreeView API](https://code.visualstudio.com/api/extension-guides/tree-view)

### ConnectionTreeItem
- **File**: `connectionTreeItem.ts`
- **Purpose**: Represents individual connection items in the tree view
- **Features**:
  - Custom icons based on connection state
  - Context values for conditional menu items
  - Tooltip with connection details

## Usage Pattern

Providers are registered in `extension.ts` during activation:

```typescript
// Create tree data provider
const connectionTreeProvider = new ConnectionTreeProvider(
  connectionStorage,
  connectionManager
);

// Register tree view
const treeView = vscode.window.createTreeView('cassandraLensConnections', {
  treeDataProvider: connectionTreeProvider,
  showCollapseAll: false
});
```

## Key Concepts

- **Separation of Concerns**: Providers focus on UI integration, while business logic lives in `services/`
- **Data Flow**: Services fetch data → Providers format it for VS Code → VS Code renders UI
- **Lifecycle**: Providers are created during extension activation and disposed on deactivation
- **Reactive Updates**: Providers listen to service events and refresh the UI automatically

## Future Enhancements

Future providers may include:
- Schema tree provider (keyspaces → tables → columns)
- CQL completion provider for query autocomplete
- CQL formatting provider for query beautification
