# Providers

This directory contains **VS Code Provider implementations** for CassandraLens.

## What Are Providers?

Providers are classes that implement VS Code interfaces to supply data and functionality to the editor. They act as bridges between your extension logic and VS Code's UI.

## Providers in CassandraLens

### TreeDataProvider
- **File**: `schemaTreeProvider.ts`
- **Purpose**: Powers the schema explorer sidebar
- **Shows**: Connections → Keyspaces → Tables → Columns hierarchy
- **Reference**: [VS Code TreeView API](https://code.visualstudio.com/api/extension-guides/tree-view)

### CompletionItemProvider
- **File**: `cqlCompletionProvider.ts`
- **Purpose**: Provides autocomplete suggestions for CQL queries
- **Shows**: Keywords, keyspace names, table names, column names
- **Reference**: [VS Code Completion Provider](https://code.visualstudio.com/api/references/vscode-api#CompletionItemProvider)

### DocumentFormattingEditProvider
- **File**: `cqlFormatterProvider.ts`
- **Purpose**: Formats CQL queries with proper indentation and capitalization
- **Reference**: [VS Code Formatting Provider](https://code.visualstudio.com/api/references/vscode-api#DocumentFormattingEditProvider)

## Usage Pattern

Providers are typically registered in `extension.ts` during activation:

```typescript
// Example: Register a TreeView provider
const treeDataProvider = new SchemaTreeProvider();
vscode.window.registerTreeDataProvider('cassandraLensExplorer', treeDataProvider);
```

## Key Concepts

- **Separation of Concerns**: Providers focus on UI integration, while business logic lives in `services/`
- **Data Flow**: Services fetch data → Providers format it for VS Code → VS Code renders UI
- **Lifecycle**: Providers are created during extension activation and disposed on deactivation
