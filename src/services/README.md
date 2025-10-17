# Services

This directory contains **business logic services** for CassandraLens.

## What Are Services?

Services encapsulate core functionality and business logic. They handle data processing, external API calls, and state management without being tied to VS Code's UI layer.

## Services in CassandraLens

### ConnectionManager
- **File**: `connectionManager.ts`
- **Purpose**: Manages active Cassandra connections and connection switching
- **Responsibilities**:
  - Track current active connection
  - Handle connection lifecycle (connect/disconnect)
  - Emit events when connection state changes
  - Provide singleton access to current connection

### CassandraClient
- **File**: `cassandraClient.ts`
- **Purpose**: Wraps the DataStax cassandra-driver with extension-specific logic
- **Responsibilities**:
  - Establish and maintain connections to Cassandra clusters
  - Execute CQL queries with error handling
  - Manage connection pooling
  - Handle authentication and SSL
  - Provide query timeout and retry logic

### ConnectionStorage
- **File**: `connectionStorage.ts`
- **Purpose**: Persists connection profiles using VS Code APIs
- **Responsibilities**:
  - Save/load connection profiles from workspace settings
  - Store credentials securely in VS Code Secret Storage
  - CRUD operations for connection profiles

### SchemaService
- **File**: `schemaService.ts`
- **Purpose**: Queries Cassandra system tables to discover schema
- **Responsibilities**:
  - Fetch keyspaces, tables, and columns
  - Cache schema data for performance
  - Provide schema refresh functionality

### QueryExecutor
- **File**: `queryExecutor.ts`
- **Purpose**: Handles CQL query execution with result formatting
- **Responsibilities**:
  - Parse and validate queries
  - Execute queries with selected consistency level
  - Format results for webview display
  - Track query execution time

### TemplateService
- **File**: `templateService.ts`
- **Purpose**: Manages query templates
- **Responsibilities**:
  - CRUD operations for query templates
  - Template parameter substitution
  - Default template loading

## Design Principles

- **Single Responsibility**: Each service has one clear purpose
- **Testability**: Services are plain TypeScript classes, easy to unit test
- **Loose Coupling**: Services communicate via interfaces, not concrete implementations
- **Dependency Injection**: Services receive dependencies via constructor for flexibility

## Usage Pattern

Services are typically instantiated in `extension.ts` and injected into providers:

```typescript
// In extension.ts
const connectionManager = new ConnectionManager(context);
const cassandraClient = new CassandraClient();
const schemaService = new SchemaService(cassandraClient);

// Pass to providers
const treeProvider = new SchemaTreeProvider(schemaService, connectionManager);
```
