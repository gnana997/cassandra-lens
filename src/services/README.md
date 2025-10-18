# Services

This directory contains **business logic services** for CassandraLens.

## What Are Services?

Services encapsulate core functionality and business logic. They handle data processing, external API calls, and state management without being tied to VS Code's UI layer.

## Currently Implemented Services

### CassandraClient
- **File**: `cassandraClient.ts`
- **Purpose**: Wraps the DataStax cassandra-driver with extension-specific logic
- **Responsibilities**:
  - Establish and maintain connections to Cassandra clusters
  - Execute CQL queries with error handling
  - Manage connection pooling and lifecycle
  - Handle authentication (PlainTextAuthProvider) and SSL/TLS
  - Test connections before saving profiles
  - Retrieve cluster metadata (version, name)
- **Key Methods**:
  - `connect(profile: ConnectionProfile): Promise<ClusterMetadata>`
  - `disconnect(): Promise<void>`
  - `testConnection(profile: ConnectionProfile): Promise<TestResult>`
  - `execute(query: string, params?: any[]): Promise<ResultSet>`
  - `isConnected(): boolean`

### ConnectionManager
- **File**: `connectionManager.ts`
- **Purpose**: Manages the active Cassandra connection and connection state
- **Responsibilities**:
  - Track current active connection profile
  - Handle connection lifecycle (connect/disconnect/reconnect)
  - Emit events when connection state changes
  - Provide singleton access to current connection
  - Notify UI components of status updates
- **Key Methods**:
  - `setActiveConnection(profile: ConnectionProfile): Promise<ClusterMetadata>`
  - `disconnect(): Promise<void>`
  - `getActiveProfile(): ConnectionProfile | null`
  - `isConnected(): boolean`
- **Events**:
  - `'connected'` - Fired when connection is established
  - `'disconnected'` - Fired when connection is closed
  - `'statusChanged'` - Fired when connection status changes

### ConnectionStorage
- **File**: `connectionStorage.ts`
- **Purpose**: Persists connection profiles using VS Code APIs
- **Responsibilities**:
  - Save/load connection profiles from workspace settings
  - Store credentials securely in VS Code Secret Storage
  - CRUD operations for connection profiles
  - Track last connected timestamp for auto-reconnect
- **Key Methods**:
  - `saveConnection(profile: ConnectionProfile): Promise<void>`
  - `loadConnections(): Promise<ConnectionProfile[]>`
  - `deleteConnection(id: string): Promise<void>`
  - `updateLastConnectedTimestamp(id: string): Promise<void>`
- **Security**:
  - Passwords stored in VS Code Secret Storage API
  - Never stores passwords in settings.json

### SchemaService
- **File**: `schemaService.ts`
- **Purpose**: Queries Cassandra system schema tables to discover keyspaces, tables, and columns
- **Responsibilities**:
  - Query `system_schema.keyspaces`, `system_schema.tables`, `system_schema.columns`
  - Cache schema metadata to avoid redundant queries
  - Filter system keyspaces (configurable)
  - Provide granular cache clearing for refresh operations
  - Sort results alphabetically (keyspaces, tables) and by position (columns)
- **Key Methods**:
  - `getKeyspaces(filterSystem: boolean): Promise<KeyspaceInfo[]>`
  - `getTables(keyspace: string): Promise<TableInfo[]>`
  - `getColumns(keyspace: string, table: string): Promise<ColumnInfo[]>`
  - `clearCache(): void` - Clears all cached data
  - `clearKeyspaceCache(keyspace: string): void` - Clears specific keyspace
  - `clearTableCache(keyspace: string, table: string): void` - Clears specific table
- **Caching Strategy**:
  - **Key Format**: Map with namespaced keys
    - `"keyspaces"` - All keyspaces
    - `"tables:{keyspace}"` - Tables in a keyspace
    - `"columns:{keyspace}:{table}"` - Columns in a table
  - **Benefits**: Avoids repeated system table queries, improves tree view performance
  - **Refresh**: Individual nodes can refresh without clearing entire cache
- **System Keyspace Filtering**:
  - Filters out: `system`, `system_schema`, `system_auth`, `system_distributed`, `system_traces`, `system_virtual_schema`
  - Configurable via `filterSystem` parameter
- **Column Metadata**:
  - Returns: name, type, kind (partition_key, clustering, regular, static), position
  - Sorted by position to maintain schema order

## Design Principles

- **Single Responsibility**: Each service has one clear purpose
- **Testability**: Services are plain TypeScript classes, easy to unit test
- **Loose Coupling**: Services communicate via interfaces, not concrete implementations
- **Dependency Injection**: Services receive dependencies via constructor for flexibility
- **Event-Driven**: ConnectionManager emits events for reactive UI updates
- **Performance**: SchemaService uses caching to minimize Cassandra queries

## Usage Pattern

Services are typically instantiated in `extension.ts` and injected into providers and commands:

```typescript
// In extension.ts
const cassandraClient = new CassandraClient();
const connectionManager = new ConnectionManager(cassandraClient);
const connectionStorage = new ConnectionStorage(context);
const schemaService = new SchemaService(cassandraClient);

// Inject into commands
const connectionCommands = new ConnectionCommands(
  connectionManager,
  connectionStorage,
  testClient,
  context.extensionUri
);

const schemaCommands = new SchemaCommands(
  connectionTreeProvider,
  schemaService
);

// Inject into providers
const connectionTreeProvider = new ConnectionTreeProvider(
  connectionStorage,
  connectionManager,
  schemaService  // Now includes schema discovery
);
```

## Service Interactions

```
┌─────────────────┐     uses      ┌──────────────────┐
│ ConnectionMgr   │──────────────▶│ CassandraClient  │
└─────────────────┘                └──────────────────┘
        │                                    ▲
        │ emits events                       │
        │                                    │ uses
        ▼                                    │
┌─────────────────┐               ┌──────────────────┐
│ ConnectionTree  │               │ SchemaService    │
│ Provider        │◀──────────────┤                  │
└─────────────────┘   queries     └──────────────────┘
                      schema
```

### ExecutionTimeTracker
- **File**: `executionTimeTracker.ts`
- **Purpose**: Tracks execution times for CQL statements and files in-memory for CodeLens display
- **Responsibilities**:
  - Record execution time, row count, and success status for individual statements
  - Track file-level aggregated execution times
  - Provide execution history for CodeLens time indicators
  - Auto-cleanup old entries (max 100 per file using LRU strategy)
- **Key Methods**:
  - `recordExecution(uri, startLine, endLine, record): void` - Record statement execution
  - `recordFileExecution(uri, executionTime): void` - Record file-level execution
  - `getExecution(uri, startLine, endLine): ExecutionRecord | undefined` - Get statement record
  - `getFileExecution(uri): number | undefined` - Get file execution time
  - `clearFile(uri): void` - Clear all executions for a file
- **Storage Strategy**:
  - **In-memory only** - Data cleared on extension reload (not persisted)
  - **Key format**: `${documentUri}:${startLine}-${endLine}` for statements
  - **Auto-cleanup**: Removes oldest entries when file exceeds 100 executions
  - **Singleton instance**: Exported as `executionTimeTracker` for shared access
- **ExecutionRecord Interface**:
  ```typescript
  {
    executionTime: number;  // Milliseconds
    rowCount: number;       // Rows returned/affected
    timestamp: Date;        // When executed
    success: boolean;       // Success or failure
  }
  ```
- **Use Cases**:
  - CodeLens displays: "⏱ Last: 23ms (5 rows)"
  - File-level displays: "⏱ Last run: 145ms total"
  - Performance tracking during development
  - Query optimization feedback

## Future Enhancements

Future services may include:
- **TemplateService** - Manage query templates and snippets
- **ExportService** - Export query results to CSV, JSON, etc.
- **MetricsService** - Track and display cluster metrics
