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

## Future Enhancements

Future services may include:
- **QueryExecutor** - Handle CQL query execution with result formatting
- **TemplateService** - Manage query templates and snippets
- **ExportService** - Export query results to CSV, JSON, etc.
- **MetricsService** - Track and display cluster metrics
