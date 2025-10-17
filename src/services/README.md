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

## Design Principles

- **Single Responsibility**: Each service has one clear purpose
- **Testability**: Services are plain TypeScript classes, easy to unit test
- **Loose Coupling**: Services communicate via interfaces, not concrete implementations
- **Dependency Injection**: Services receive dependencies via constructor for flexibility
- **Event-Driven**: ConnectionManager emits events for reactive UI updates

## Usage Pattern

Services are typically instantiated in `extension.ts` and injected into providers and commands:

```typescript
// In extension.ts
const cassandraClient = new CassandraClient();
const connectionManager = new ConnectionManager(cassandraClient);
const connectionStorage = new ConnectionStorage(context);

// Inject into commands
const connectionCommands = new ConnectionCommands(
  connectionManager,
  connectionStorage,
  testClient,
  context.extensionUri
);

// Inject into providers
const connectionTreeProvider = new ConnectionTreeProvider(
  connectionStorage,
  connectionManager
);
```

## Future Enhancements

Future services may include:
- **SchemaService** - Query Cassandra system tables to discover schema
- **QueryExecutor** - Handle CQL query execution with result formatting
- **TemplateService** - Manage query templates and snippets
