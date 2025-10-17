# CassandraLens MVP - Core Features PRD

## Version 0.1.0 - Direct Connection Mode

**Target Timeline:** 8-10 weeks

---

## 1. Executive Summary

This document outlines the **Minimum Viable Product (MVP)** for CassandraLens, focusing on core database management features without platform-specific integrations. The MVP targets developers and DBAs who need basic Cassandra management within VS Code, connecting to clusters via direct IP/hostname connections.

### MVP Scope
- ✅ Direct connection to Cassandra clusters (IP/hostname + port)
- ✅ Complete schema browser and management (keyspaces, tables, indexes)
- ✅ CQL query editor with syntax highlighting and autocomplete
- ✅ Table data browser with CRUD operations
- ✅ Basic cluster monitoring (node status, basic metrics)
- ❌ NOT included: Kubernetes, AWS, Docker, advanced monitoring, backup/restore

---

## 2. Feature Requirements

### 2.1 Connection Management

#### 2.1.1 Direct Connection Support
**Priority:** P0 (Must Have)

**Features:**
- Save multiple connection profiles
- Test connection before saving
- Auto-reconnect on connection loss
- Connection status indicator in status bar

**Connection Profile Schema:**
```json
{
  "name": "Production Cluster",
  "contactPoints": ["10.0.1.10", "10.0.1.11", "10.0.1.12"],
  "port": 9042,
  "localDataCenter": "dc1",
  "keyspace": "",  // Optional default keyspace
  "auth": {
    "enabled": true,
    "username": "cassandra",
    "password": "***"  // Stored in VS Code Secret Storage
  },
  "ssl": {
    "enabled": false,
    "rejectUnauthorized": true,
    "ca": "",
    "cert": "",
    "key": ""
  },
  "socketOptions": {
    "connectTimeout": 30000,
    "readTimeout": 12000
  }
}
```

**UI Components:**
- "Add Connection" button in sidebar
- Connection form with validation
- Connection list with quick connect/disconnect
- Edit/Delete context menu actions

**Technical Implementation:**
```typescript
// Use DataStax Node.js driver
import { Client } from 'cassandra-driver';

const client = new Client({
  contactPoints: profile.contactPoints,
  localDataCenter: profile.localDataCenter,
  keyspace: profile.keyspace,
  authProvider: profile.auth.enabled 
    ? new auth.PlainTextAuthProvider(
        profile.auth.username, 
        profile.auth.password
      )
    : undefined,
  sslOptions: profile.ssl.enabled ? {
    rejectUnauthorized: profile.ssl.rejectUnauthorized,
    ca: profile.ssl.ca ? [fs.readFileSync(profile.ssl.ca)] : undefined
  } : undefined
});

await client.connect();
```

**Technical References:**
- [DataStax Node.js Driver - Getting Started](https://docs.datastax.com/en/developer/nodejs-driver/4.7/)
- [Authentication](https://docs.datastax.com/en/developer/nodejs-driver/4.7/features/connection-pooling/)

---

### 2.2 Schema Browser & Management

#### 2.2.1 TreeView Navigation
**Priority:** P0 (Must Have)

**Tree Structure:**
```
📦 CASSANDRALENS
└── 🔌 CONNECTIONS
    ├── ➕ Add Connection
    └── 📦 Production Cluster (Connected)
        ├── 🔑 system (keyspace)
        │   ├── 📊 peers (table)
        │   └── 📊 local (table)
        ├── 🔑 system_auth
        ├── 🔑 my_app
        │   ├── 📊 users
        │   │   ├── 🔑 user_id (UUID, PRIMARY KEY)
        │   │   ├── email (TEXT)
        │   │   ├── username (TEXT)
        │   │   ├── created_at (TIMESTAMP)
        │   │   └── 🔍 email_idx (index)
        │   ├── 📊 orders
        │   └── 📊 sessions
        └── 🔧 Operations
            ├── 🔄 New Query
            ├── 📊 Cluster Status
            └── ⚙️ Settings
```

**Implementation:**
```typescript
// TreeView data provider
class CassandraTreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!element) {
      // Root level - show connections
      return this.getConnections();
    }
    
    if (element.type === 'connection') {
      // Show keyspaces
      return this.getKeyspaces(element.connection);
    }
    
    if (element.type === 'keyspace') {
      // Show tables
      return this.getTables(element.connection, element.keyspace);
    }
    
    if (element.type === 'table') {
      // Show columns and indexes
      return this.getColumnsAndIndexes(element.connection, element.keyspace, element.table);
    }
  }
  
  private async getKeyspaces(client: Client): Promise<TreeItem[]> {
    const query = "SELECT keyspace_name FROM system_schema.keyspaces";
    const result = await client.execute(query);
    
    return result.rows.map(row => new KeyspaceTreeItem(row.keyspace_name));
  }
  
  private async getTables(client: Client, keyspace: string): Promise<TreeItem[]> {
    const query = `SELECT table_name FROM system_schema.tables WHERE keyspace_name = ?`;
    const result = await client.execute(query, [keyspace]);
    
    return result.rows.map(row => new TableTreeItem(row.table_name));
  }
}
```

**Context Menu Actions:**

**Keyspace:**
- Browse Tables
- New Table
- Describe Keyspace
- Drop Keyspace
- Copy Name

**Table:**
- Browse Data (opens data browser)
- New Query (opens query editor with SELECT template)
- Insert Row
- Describe Table
- Drop Table
- Truncate Table
- Copy Name

**Column:**
- Copy Name
- View Properties

**Index:**
- Drop Index
- Copy Name

#### 2.2.2 Keyspace Operations
**Priority:** P0 (Must Have)

**Create Keyspace Dialog:**
```
┌─────────────────────────────────────────┐
│ Create Keyspace                         │
├─────────────────────────────────────────┤
│ Name: * [_________________]             │
│                                         │
│ Replication Strategy: *                 │
│   ● SimpleStrategy                      │
│   ○ NetworkTopologyStrategy             │
│                                         │
│ Replication Factor: [3▼]                │
│                                         │
│ Data Centers (NetworkTopology only):    │
│ ┌───────────────────────────────────┐   │
│ │ DC Name        Replication Factor │   │
│ │ dc1            3                  │   │
│ │ [Add DC]                          │   │
│ └───────────────────────────────────┘   │
│                                         │
│ □ Durable Writes                        │
│                                         │
│ CQL Preview:                            │
│ ┌───────────────────────────────────┐   │
│ │ CREATE KEYSPACE my_app WITH       │   │
│ │   replication = {                 │   │
│ │     'class': 'SimpleStrategy',    │   │
│ │     'replication_factor': 3       │   │
│ │   };                              │   │
│ └───────────────────────────────────┘   │
│                                         │
│           [Cancel]  [Create]            │
└─────────────────────────────────────────┘
```

**CQL Commands:**
```sql
-- Create with SimpleStrategy
CREATE KEYSPACE my_app 
WITH replication = {
  'class': 'SimpleStrategy',
  'replication_factor': 3
} 
AND durable_writes = true;

-- Create with NetworkTopologyStrategy
CREATE KEYSPACE my_app 
WITH replication = {
  'class': 'NetworkTopologyStrategy',
  'dc1': 3,
  'dc2': 2
};

-- Describe
DESCRIBE KEYSPACE my_app;

-- Alter
ALTER KEYSPACE my_app 
WITH replication = {
  'class': 'SimpleStrategy',
  'replication_factor': 5
};

-- Drop
DROP KEYSPACE IF EXISTS my_app;
```

**Validation Rules:**
- Name: lowercase, alphanumeric + underscore only
- Name: cannot start with "system"
- Replication factor: minimum 1, maximum = cluster size
- At least one datacenter required for NetworkTopologyStrategy

#### 2.2.3 Table Designer
**Priority:** P0 (Must Have)

**Visual Table Designer Interface:**
```
┌─────────────────────────────────────────────────────────┐
│ Create Table: my_app.users                              │
├─────────────────────────────────────────────────────────┤
│ Columns:                                                │
│ ┌───────────────────────────────────────────────────┐   │
│ │ Name          Type       Partition  Clustering    │   │
│ │ user_id       UUID          ☑          ☐         │   │
│ │ email         TEXT          ☐          ☐         │   │
│ │ username      TEXT          ☐          ☐         │   │
│ │ created_at    TIMESTAMP     ☐          ☑ (ASC)   │   │
│ │ [+ Add Column]                                    │   │
│ └───────────────────────────────────────────────────┘   │
│                                                         │
│ Table Options:                                          │
│   Compaction Strategy: [LeveledCompactionStrategy ▼]    │
│   GC Grace Seconds: [864000_______]                     │
│   Bloom Filter FP Chance: [0.01_______]                 │
│   Comment: [__________________]                         │
│                                                         │
│ CQL Preview:                                            │
│ ┌───────────────────────────────────────────────────┐   │
│ │ CREATE TABLE my_app.users (                       │   │
│ │   user_id UUID,                                   │   │
│ │   email TEXT,                                     │   │
│ │   username TEXT,                                  │   │
│ │   created_at TIMESTAMP,                           │   │
│ │   PRIMARY KEY (user_id, created_at)               │   │
│ │ ) WITH CLUSTERING ORDER BY (created_at ASC)       │   │
│ │   AND compaction = {                              │   │
│ │     'class': 'LeveledCompactionStrategy'          │   │
│ │   };                                              │   │
│ └───────────────────────────────────────────────────┘   │
│                                                         │
│                    [Cancel]  [Create]                   │
└─────────────────────────────────────────────────────────┘
```

**Data Type Picker:**
Support for all CQL data types with descriptions:
- **Numeric:** tinyint, smallint, int, bigint, varint, float, double, decimal
- **Text:** text, varchar, ascii
- **Binary:** blob
- **Boolean:** boolean
- **Date/Time:** timestamp, date, time, duration
- **UUID:** uuid, timeuuid
- **Collections:** list<type>, set<type>, map<key_type, value_type>
- **Network:** inet

**CQL Commands:**
```sql
-- Create table
CREATE TABLE users (
  user_id UUID,
  email TEXT,
  username TEXT,
  created_at TIMESTAMP,
  profile MAP<TEXT, TEXT>,
  tags SET<TEXT>,
  PRIMARY KEY (user_id, created_at)
) WITH CLUSTERING ORDER BY (created_at DESC)
AND compaction = {'class': 'LeveledCompactionStrategy'}
AND gc_grace_seconds = 864000;

-- Alter table - add column
ALTER TABLE users ADD phone TEXT;

-- Alter table - drop column
ALTER TABLE users DROP phone;

-- Describe table
DESCRIBE TABLE users;

-- Drop table
DROP TABLE IF EXISTS users;

-- Truncate
TRUNCATE TABLE users;
```

#### 2.2.4 Index Management
**Priority:** P1 (Should Have)

**Create Index Dialog:**
```
┌─────────────────────────────────────────┐
│ Create Index                            │
├─────────────────────────────────────────┤
│ Table: my_app.users                     │
│                                         │
│ Column: [email ▼]                       │
│                                         │
│ Index Name (optional):                  │
│ [users_email_idx__________]             │
│                                         │
│ CQL Preview:                            │
│ ┌───────────────────────────────────┐   │
│ │ CREATE INDEX users_email_idx      │   │
│ │ ON my_app.users (email);          │   │
│ └───────────────────────────────────┘   │
│                                         │
│           [Cancel]  [Create]            │
└─────────────────────────────────────────┘
```

**CQL Commands:**
```sql
-- Create unnamed index
CREATE INDEX ON users (email);

-- Create named index
CREATE INDEX users_email_idx ON users (email);

-- List indexes for table
SELECT index_name FROM system_schema.indexes 
WHERE keyspace_name = 'my_app' AND table_name = 'users';

-- Drop index
DROP INDEX IF EXISTS my_app.users_email_idx;
```

---

### 2.3 CQL Query Editor

#### 2.3.1 Query Editor Features
**Priority:** P0 (Must Have)

**Features:**
- Multi-tab editor (create unlimited query tabs)
- Syntax highlighting for CQL keywords
- Auto-completion for:
  - CQL keywords (SELECT, INSERT, UPDATE, DELETE, etc.)
  - Keyspace names
  - Table names
  - Column names
- Execute query: Ctrl+Enter (or Cmd+Enter on Mac)
- Execute all queries in file
- Query execution time display
- Row count display
- Results in table format
- Export results (CSV, JSON)

**Code Snippets:**
```
sel → SELECT * FROM ${1:table} WHERE ${2:condition};
ins → INSERT INTO ${1:table} (${2:columns}) VALUES (${3:values});
upd → UPDATE ${1:table} SET ${2:column} = ${3:value} WHERE ${4:condition};
del → DELETE FROM ${1:table} WHERE ${2:condition};
ctbl → CREATE TABLE ${1:table} (
        ${2:id} UUID PRIMARY KEY,
        ${3:column} TEXT
      );
cks → CREATE KEYSPACE ${1:keyspace}
      WITH replication = {
        'class': 'SimpleStrategy',
        'replication_factor': ${2:3}
      };
```

**Example Queries:**
```sql
-- Simple SELECT
SELECT * FROM users WHERE user_id = 550e8400-e29b-41d4-a716-446655440000;

-- SELECT with LIMIT
SELECT * FROM users LIMIT 100;

-- SELECT with ALLOW FILTERING (show warning icon)
SELECT * FROM users WHERE email = 'user@example.com' ALLOW FILTERING;

-- SELECT with token range
SELECT * FROM users WHERE TOKEN(user_id) > TOKEN(?);

-- INSERT
INSERT INTO users (user_id, email, username, created_at)
VALUES (uuid(), 'john@example.com', 'johndoe', toTimestamp(now()));

-- INSERT JSON
INSERT INTO users JSON '{"user_id": "...", "email": "..."}';

-- UPDATE
UPDATE users 
SET email = 'newemail@example.com',
    profile = profile + {'bio': 'Software Engineer'}
WHERE user_id = 550e8400-e29b-41d4-a716-446655440000;

-- UPDATE with TTL
UPDATE users USING TTL 86400
SET session_token = 'xyz'
WHERE user_id = ?;

-- DELETE
DELETE FROM users 
WHERE user_id = 550e8400-e29b-41d4-a716-446655440000;

-- BATCH operations
BEGIN BATCH
  INSERT INTO users (user_id, email) VALUES (uuid(), 'user1@ex.com');
  INSERT INTO users (user_id, email) VALUES (uuid(), 'user2@ex.com');
  UPDATE users SET email = 'updated@ex.com' WHERE user_id = ?;
APPLY BATCH;

-- USE keyspace
USE my_app;

-- DESCRIBE commands
DESCRIBE KEYSPACES;
DESCRIBE KEYSPACE my_app;
DESCRIBE TABLES;
DESCRIBE TABLE users;
```

**Result Display:**
```
┌──────────────────────────────────────────────────────────────┐
│ Query: SELECT * FROM users LIMIT 5                           │
│ Execution Time: 23ms  Rows: 5                                │
├──────────────────────────────────────────────────────────────┤
│ user_id                              │ email            │... │
├──────────────────────────────────────────────────────────────┤
│ 550e8400-e29b-41d4-a716-446655440000 │ john@example.com │    │
│ 6ba7b810-9dad-11d1-80b4-00c04fd430c8 │ jane@example.com │    │
│ ...                                  │ ...              │    │
└──────────────────────────────────────────────────────────────┘

[Export CSV] [Export JSON] [Copy]
```

**Implementation:**
```typescript
// Register CQL language
const cqlLanguageProvider = vscode.languages.registerCompletionItemProvider(
  'cql',
  {
    provideCompletionItems(document, position) {
      // Get current connection
      const connection = getCurrentConnection();
      
      // Provide keyword completions
      const keywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', ...];
      
      // Provide keyspace completions
      const keyspaces = await getKeyspaces(connection);
      
      // Provide table completions if in USE context
      const tables = await getTables(connection, currentKeyspace);
      
      return [...keywords, ...keyspaces, ...tables].map(item => 
        new vscode.CompletionItem(item)
      );
    }
  }
);

// Execute query command
vscode.commands.registerCommand('cassandralens.executeQuery', async () => {
  const editor = vscode.window.activeTextEditor;
  const query = editor.selection.isEmpty 
    ? editor.document.getText()
    : editor.document.getText(editor.selection);
    
  const client = getCurrentConnection();
  const startTime = Date.now();
  
  try {
    const result = await client.execute(query);
    const executionTime = Date.now() - startTime;
    
    // Display results in webview
    displayResults(result, executionTime);
  } catch (error) {
    vscode.window.showErrorMessage(`Query failed: ${error.message}`);
  }
});
```

#### 2.3.2 Query History
**Priority:** P1 (Should Have)

**Features:**
- Save last 100 queries per connection
- Search query history
- Re-run query from history
- Favorite queries
- Clear history

**UI:**
```
QUERY HISTORY
├── 🕐 Today
│   ├── SELECT * FROM users LIMIT 100 (23ms)
│   ├── INSERT INTO users ... (15ms)
│   └── UPDATE users SET ... (8ms)
├── 🕑 Yesterday
│   └── ...
└── 🕒 Last 7 Days
    └── ...
```

---

### 2.4 Data Browser & Editor

#### 2.4.1 Table Data Browser
**Priority:** P0 (Must Have)

**Features:**
- Spreadsheet-like view
- Pagination (configurable: 50, 100, 500 rows per page)
- Column sorting (where supported by Cassandra)
- Search within loaded data (client-side)
- Add new row
- Edit existing row
- Delete row
- Refresh data
- Export visible rows

**UI Layout:**
```
┌────────────────────────────────────────────────────────────┐
│ Table: my_app.users                                        │
│ [🔄 Refresh] [➕ Add Row] [📤 Export] [⚙️ Settings]        │
├────────────────────────────────────────────────────────────┤
│ 🔍 Search: [___________]     Page Size: [100 ▼]           │
├────────────────────────────────────────────────────────────┤
│ ☐ │ user_id        │ email             │ username │ ...   │
├───┼────────────────┼───────────────────┼──────────┼───────┤
│ ☐ │ 550e8400-e29b...│ john@example.com │ johndoe  │       │
│ ☐ │ 6ba7b810-9dad...│ jane@example.com │ janedoe  │       │
│ ☐ │ ...            │ ...              │ ...      │       │
└────────────────────────────────────────────────────────────┘
 Showing 1-100 of 1,250 rows  [◀ Previous] [Next ▶]
```

**Row Editor Dialog:**
```
┌─────────────────────────────────────────┐
│ Edit Row: users                         │
├─────────────────────────────────────────┤
│ user_id (UUID): *                       │
│ 550e8400-e29b-41d4-a716-446655440000    │
│ [🔄 Generate New UUID]                  │
│                                         │
│ email (TEXT): *                         │
│ [john@example.com_______________]       │
│                                         │
│ username (TEXT):                        │
│ [johndoe____________________]           │
│                                         │
│ created_at (TIMESTAMP):                 │
│ [2024-01-15 10:30:00_______] [📅 Now]  │
│                                         │
│ profile (MAP<TEXT,TEXT>):               │
│ ┌───────────────────────────────────┐   │
│ │ Key         Value                 │   │
│ │ bio         Software Engineer     │   │
│ │ location    San Francisco         │   │
│ │ [+ Add]                           │   │
│ └───────────────────────────────────┘   │
│                                         │
│           [Cancel]  [Save]              │
└─────────────────────────────────────────┘
```

**Implementation:**
```typescript
// Fetch data with paging
async function fetchTableData(
  client: Client,
  keyspace: string,
  table: string,
  pageSize: number,
  pageState?: string
) {
  const query = `SELECT * FROM ${keyspace}.${table}`;
  
  const options = {
    prepare: true,
    fetchSize: pageSize,
    pageState: pageState
  };
  
  const result = await client.execute(query, [], options);
  
  return {
    rows: result.rows,
    pageState: result.pageState,
    hasMore: result.pageState !== null
  };
}

// Insert row
async function insertRow(
  client: Client,
  keyspace: string,
  table: string,
  values: Record<string, any>
) {
  const columns = Object.keys(values);
  const placeholders = columns.map(() => '?').join(', ');
  
  const query = `
    INSERT INTO ${keyspace}.${table} 
    (${columns.join(', ')}) 
    VALUES (${placeholders})
  `;
  
  await client.execute(query, Object.values(values), { prepare: true });
}

// Update row
async function updateRow(
  client: Client,
  keyspace: string,
  table: string,
  primaryKey: Record<string, any>,
  updates: Record<string, any>
) {
  const setClauses = Object.keys(updates)
    .map(col => `${col} = ?`)
    .join(', ');
    
  const whereClauses = Object.keys(primaryKey)
    .map(col => `${col} = ?`)
    .join(' AND ');
  
  const query = `
    UPDATE ${keyspace}.${table}
    SET ${setClauses}
    WHERE ${whereClauses}
  `;
  
  const params = [...Object.values(updates), ...Object.values(primaryKey)];
  await client.execute(query, params, { prepare: true });
}
```

#### 2.4.2 Collection Type Support
**Priority:** P1 (Should Have)

**Visual Editors for Collections:**

**LIST Editor:**
```
┌─────────────────────────┐
│ LIST<TEXT>              │
├─────────────────────────┤
│ [value1_______] [🗑]   │
│ [value2_______] [🗑]   │
│ [value3_______] [🗑]   │
│ [+ Add Item]            │
└─────────────────────────┘
```

**SET Editor:**
```
┌─────────────────────────┐
│ SET<INT>                │
├─────────────────────────┤
│ [1_______] [🗑]        │
│ [5_______] [🗑]        │
│ [10______] [🗑]        │
│ [+ Add Item]            │
└─────────────────────────┘
```

**MAP Editor:**
```
┌─────────────────────────────────┐
│ MAP<TEXT, TEXT>                 │
├─────────────────────────────────┤
│ Key       │ Value        [🗑]  │
│ name      │ John Smith   [🗑]  │
│ email     │ john@ex.com  [🗑]  │
│ [+ Add Entry]                   │
└─────────────────────────────────┘
```

#### 2.4.3 Import/Export
**Priority:** P1 (Should Have)

**Export Options:**
- CSV (with headers)
- JSON (array of objects)
- Export visible rows only
- Export all rows (paginate automatically)

**Import Options:**
- CSV file (with column mapping)
- JSON file
- Batch size: configurable (default 50)
- Continue on error / Stop on error

**Export Implementation:**
```typescript
async function exportToCSV(
  client: Client,
  keyspace: string,
  table: string,
  filename: string
) {
  const stream = fs.createWriteStream(filename);
  const query = `SELECT * FROM ${keyspace}.${table}`;
  
  const options = {
    prepare: true,
    fetchSize: 1000
  };
  
  let isFirstRow = true;
  
  client.stream(query, [], options)
    .on('readable', function() {
      let row;
      while (row = this.read()) {
        if (isFirstRow) {
          // Write headers
          stream.write(Object.keys(row).join(',') + '\n');
          isFirstRow = false;
        }
        // Write row
        stream.write(Object.values(row).join(',') + '\n');
      }
    })
    .on('end', function() {
      stream.end();
    });
}
```

---

### 2.5 Basic Cluster Monitoring

#### 2.5.1 Cluster Status View
**Priority:** P0 (Must Have)

**Features:**
- Show cluster name
- List all nodes with status
- Node load (data size)
- Token ownership %
- Uptime
- Node datacenter and rack

**nodetool status equivalent:**
```bash
nodetool status
```

**Implementation:**
```sql
-- Get cluster name
SELECT cluster_name FROM system.local;

-- Get all nodes
SELECT * FROM system.peers_v2;
SELECT * FROM system.local;

-- Node status info includes:
-- - peer (IP address)
-- - data_center
-- - rack
-- - host_id
-- - tokens
```

**UI Display:**
```
┌────────────────────────────────────────────────────────┐
│ Cluster: Production Cluster                           │
├────────────────────────────────────────────────────────┤
│ Datacenter: dc1                                        │
│ ═══════════════════════════════════════════════════    │
│ Status  │ Address    │ Load    │ Tokens │ Owns │ Rack│
│ ────────┼────────────┼─────────┼────────┼──────┼─────│
│ 🟢 UP   │ 10.0.1.10  │ 256 GB  │ 256    │ 20%  │ r1  │
│ 🟢 UP   │ 10.0.1.11  │ 245 GB  │ 256    │ 19%  │ r1  │
│ 🟢 UP   │ 10.0.1.12  │ 260 GB  │ 256    │ 20%  │ r2  │
│                                                        │
│ Total Nodes: 3  |  Up: 3  |  Down: 0                  │
│ Total Load: 761 GB                                     │
└────────────────────────────────────────────────────────┘
```

#### 2.5.2 Basic Metrics Display
**Priority:** P1 (Should Have)

**Metrics to Show:**
- Connected clients count
- Read/Write operations count (from system tables)
- Keyspaces count
- Tables count

**Implementation:**
```sql
-- Get keyspace count
SELECT COUNT(*) FROM system_schema.keyspaces;

-- Get table count
SELECT COUNT(*) FROM system_schema.tables;

-- Get client connections (requires JMX - skip for MVP)
-- Focus on simple queries only
```

**Simple Dashboard:**
```
┌─────────────────────────────────────┐
│ Cluster Overview                    │
├─────────────────────────────────────┤
│ Keyspaces:      8                   │
│ Tables:         42                   │
│ Nodes:          3 (All Up)          │
│ Replication:    RF=3                │
└─────────────────────────────────────┘
```

---

## 3. User Interface

### 3.1 Activity Bar Icon
- Custom Cassandra icon (C + database symbol)
- Badge showing active connections count

### 3.2 Commands (Command Palette)
All commands prefixed with `CassandraLens:`
- Connect to Cluster
- Disconnect from Cluster
- New Query
- Execute Query
- Browse Table Data
- Create Keyspace
- Create Table
- Refresh Schema
- Show Cluster Status

### 3.3 Status Bar
- Connection status indicator
  - "$(database) CassandraLens: Connected to Production" (green)
  - "$(database) CassandraLens: Disconnected" (gray)
  - Click to show quick actions

### 3.4 Output Channel
- Log connection events
- Log query execution
- Show errors and warnings

---

## 4. Technical Implementation

### 4.1 Dependencies

**Core:**
```json
{
  "dependencies": {
    "cassandra-driver": "^4.7.2",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/vscode": "^1.80.0",
    "@types/cassandra-driver": "^3.6.0",
    "typescript": "^5.0.0"
  }
}
```

### 4.2 Project Structure
```
cassandralens/
├── src/
│   ├── extension.ts              # Entry point
│   ├── providers/
│   │   ├── treeViewProvider.ts   # Schema tree
│   │   └── queryProvider.ts      # Query editor
│   ├── services/
│   │   ├── cassandraClient.ts    # Driver wrapper
│   │   └── connectionManager.ts  # Connection pooling
│   ├── webviews/
│   │   ├── queryEditor.ts        # Query editor webview
│   │   └── dataExplorer.ts       # Data browser webview
│   ├── commands/
│   │   ├── schemaCommands.ts
│   │   ├── queryCommands.ts
│   │   └── dataCommands.ts
│   └── utils/
│       ├── cqlFormatter.ts
│       └── typeMapper.ts
├── media/                        # Icons, CSS
├── package.json
└── tsconfig.json
```

### 4.3 Configuration Settings
```json
{
  "cassandralens.connections": [],
  "cassandralens.query.defaultLimit": 100,
  "cassandralens.query.fetchSize": 5000,
  "cassandralens.query.saveHistory": true,
  "cassandralens.query.maxHistorySize": 100,
  "cassandralens.dataBrowser.pageSize": 100,
  "cassandralens.dataBrowser.enableEditing": true
}
```

---

## 5. Testing Plan

### 5.1 Unit Tests
- Connection manager
- CQL query parser
- Data type conversion
- Tree view data provider

### 5.2 Integration Tests
- Connect to Cassandra (use Docker container)
- Create/drop keyspace
- Create/drop table
- CRUD operations
- Query execution

### 5.3 Manual Testing
- Test with Cassandra 3.x and 4.x
- Test with different authentication modes
- Test with SSL enabled
- Test large result sets
- Test complex data types (collections, UDTs)

---

## 6. Documentation

### 6.1 README.md
- Extension overview
- Installation instructions
- Quick start guide
- Feature highlights with screenshots
- Requirements (VS Code version, Cassandra version)

### 6.2 Usage Guide
- How to add connection
- How to browse schema
- How to write queries
- How to edit table data
- Keyboard shortcuts

### 6.3 FAQ
- Connection troubleshooting
- Common errors
- Performance tips

---

## 7. Success Criteria

### 7.1 Functionality
- ✅ Can connect to any Cassandra cluster via direct connection
- ✅ Can browse all keyspaces and tables
- ✅ Can execute any valid CQL query
- ✅ Can perform CRUD operations on table data
- ✅ Can view cluster status

### 7.2 Performance
- Connection establishment: < 3 seconds
- Query execution (100 rows): < 500ms
- Tree view refresh: < 2 seconds
- UI responsiveness: No blocking operations

### 7.3 Stability
- No crashes during normal operations
- Graceful error handling
- Automatic reconnection on connection loss

---

## 8. Release Checklist

### 8.1 Pre-release
- [ ] All P0 features complete
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Manual testing completed
- [ ] Documentation written
- [ ] Icon and branding finalized

### 8.2 Release
- [ ] Package extension (.vsix)
- [ ] Test installation from .vsix
- [ ] Publish to VS Code Marketplace
- [ ] Create GitHub release
- [ ] Announce on social media

### 8.3 Post-release
- [ ] Monitor user feedback
- [ ] Fix critical bugs (hotfix if needed)
- [ ] Plan Phase 2 features

---

## 9. Known Limitations (MVP)

1. **No Kubernetes Support** - Must use direct IP/hostname
2. **No AWS/Azure/GCP Integration** - Manual connection setup required
3. **No Advanced Monitoring** - Basic cluster status only (no JMX metrics)
4. **No Backup/Restore** - nodetool operations not included
5. **No Repair Operations** - Maintenance features in Phase 2
6. **No User Management** - Cannot create/manage users
7. **No Materialized Views** - MV support in Phase 2
8. **No Query Tracing** - Advanced features in Phase 2

---

## 10. Future Roadmap (Phase 2)

See separate document: **CassandraLens - Platform Expansion PRD**

- Kubernetes integration
- AWS EC2 discovery
- Docker container support
- Advanced monitoring (JMX)
- Backup & restore
- Repair operations
- Multi-region support

---

## References

- [DataStax Node.js Driver Documentation](https://docs.datastax.com/en/developer/nodejs-driver/4.7/)
- [CQL Reference](https://cassandra.apache.org/doc/latest/cassandra/cql/)
- [VS Code Extension API](https://code.visualstudio.com/api)
- [VS Code TreeView Guide](https://code.visualstudio.com/api/extension-guides/tree-view)
- [VS Code Webview Guide](https://code.visualstudio.com/api/extension-guides/webview)

---

**End of MVP PRD**