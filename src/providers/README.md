# Providers

This directory contains **VS Code Provider implementations** for CassandraLens.

## What Are Providers?

Providers are classes that implement VS Code interfaces to supply data and functionality to the editor. They act as bridges between your extension logic and VS Code's UI.

## Currently Implemented Providers

### ConnectionTreeProvider
- **File**: `connectionTreeProvider.ts`
- **Purpose**: Powers the Connections sidebar tree view with hierarchical schema display
- **Shows**: Connection profiles with expandable schema hierarchy (Connection → Keyspaces → Tables → Columns)
- **Features**:
  - Displays connection name and contact points
  - Shows connection state (connected/disconnected/error) with visual indicators
  - Automatically refreshes when connection state changes
  - Lazy-loads schema nodes (keyspaces only loaded when connection expanded)
  - Supports node-specific refresh with intelligent cache clearing
  - Reads `filterSystemKeyspaces` configuration for user preferences
  - Provides context menu actions for connections and schema items
- **Reference**: [VS Code TreeView API](https://code.visualstudio.com/api/extension-guides/tree-view)

### ConnectionTreeItem
- **File**: `connectionTreeItem.ts`
- **Purpose**: Represents individual connection items in the tree view
- **Features**:
  - Custom icons based on connection state (check/error/database)
  - Context values for conditional menu items (connection-connected, connection-disconnected, connection-error)
  - Tooltip with connection details (contact points, datacenter, SSL, auth)
  - Collapsible state (expandable when connected, non-expandable when disconnected)

## Schema Tree Items

These items represent Cassandra schema objects in the hierarchical tree view.

### SchemaTreeItem
- **File**: `schemaTreeItem.ts`
- **Purpose**: Abstract base class for all schema-related tree items
- **Features**:
  - Defines common `nodeType` and `keyspace` properties
  - Enforces consistent structure across schema items
  - Enables type discrimination with `instanceof` checks

### KeyspaceTreeItem
- **File**: `keyspaceTreeItem.ts`
- **Purpose**: Represents Cassandra keyspaces in the tree
- **Features**:
  - Namespace icon (`symbol-namespace`)
  - Collapsible state (expands to show tables)
  - Context value: `keyspace`
  - Tooltip with expansion instructions

### TableTreeItem
- **File**: `tableTreeItem.ts`
- **Purpose**: Represents Cassandra tables in the tree
- **Features**:
  - Class/table icon (`symbol-class`)
  - Collapsible state (expands to show columns)
  - Description shows qualified name (`keyspace.table`)
  - Context value: `table`
  - Tooltip with action hints

### ColumnTreeItem
- **File**: `columnTreeItem.ts`
- **Purpose**: Represents Cassandra columns in the tree (leaf nodes)
- **Features**:
  - **Color-coded icons** based on column kind:
    - 🟨 Partition Key: Yellow key icon
    - 🟦 Clustering Key: Blue numeric icon
    - 🟪 Static Column: Purple constant icon
    - ⚪ Regular Column: Standard field icon
  - **Labels** in description: (PK), (CK), (static)
  - **Detailed tooltip** with kind explanation
  - Context values: `column-partition-key`, `column-clustering`, `column-static`, `column-regular`
  - Not collapsible (leaf nodes)

## Usage Pattern

Providers are registered in `extension.ts` during activation:

```typescript
// Create tree data provider with schema support
const connectionTreeProvider = new ConnectionTreeProvider(
  connectionStorage,
  connectionManager,
  schemaService  // Injected for schema discovery
);

// Register tree view with collapse support
const treeView = vscode.window.createTreeView('cassandraLensConnections', {
  treeDataProvider: connectionTreeProvider,
  showCollapseAll: true  // Enabled for schema hierarchy
});
```

## Key Concepts

- **Separation of Concerns**: Providers focus on UI integration, while business logic lives in `services/`
- **Data Flow**: Services fetch data → Providers format it for VS Code → VS Code renders UI
- **Lifecycle**: Providers are created during extension activation and disposed on deactivation
- **Reactive Updates**: Providers listen to service events and refresh the UI automatically
- **Lazy Loading**: Child nodes (keyspaces, tables, columns) are only loaded when parent is expanded
- **Type Discrimination**: Uses `instanceof` checks to handle different node types in `getChildren()`
- **Caching**: Schema data is cached by SchemaService to avoid redundant Cassandra queries
- **Configurable Filtering**: System keyspaces can be hidden via `cassandraLens.schema.filterSystemKeyspaces` setting

## Tree Hierarchy

```
📦 Connection (CassandraClient 3.11)
├── 📁 system
│   ├── 📄 local
│   │   ├── 🔑 key (partition_key) text (PK)
│   │   ├── 🔢 bootstrapped (clustering) text (CK)
│   │   └── ⚪ cluster_name (regular) text
│   └── 📄 peers
├── 📁 system_schema
│   ├── 📄 keyspaces
│   ├── 📄 tables
│   └── 📄 columns
└── 📁 my_keyspace
    └── 📄 users
        ├── 🔑 user_id (partition_key) uuid (PK)
        ├── 🔢 created_at (clustering) timestamp (CK)
        ├── 🟪 total_posts (static) int (static)
        └── ⚪ email (regular) text
```

## Context Menu Support

Different tree items have different context menus based on their `contextValue`:

- **connection-connected**: Disconnect, Edit, Delete, Refresh
- **connection-disconnected**: Connect, Edit, Delete
- **connection-error**: Connect, Edit, Delete
- **keyspace**: Copy Name, Refresh
- **table**: Browse Data, Describe Table, Copy Name, Refresh
- **column-***: Copy Name, Copy Path

## Future Enhancements

Future providers may include:
- CQL completion provider for query autocomplete
- CQL formatting provider for query beautification
- Diagnostics provider for CQL syntax errors
