# Utils

This directory is reserved for **utility functions and helper classes** for CassandraLens.

## What Are Utils?

Utilities are reusable functions and classes that don't fit into specific services or providers. They provide common functionality used throughout the extension.

## Current Status

**This directory is currently empty.** All validation logic is currently implemented inline within React components.

### Previous Content (Removed)
- ~~`multiStepInput.ts`~~ - Removed (replaced by React-based webview form)
- ~~`validators.ts`~~ - Removed (validation logic moved inline to React App.tsx)

## Future Utilities

As the extension grows, this directory may include:

### CQL Parser
- **Purpose**: Parse and analyze CQL query text
- **Functions**:
  - `extractTableName(query: string): string` - Gets table from SELECT/INSERT
  - `extractWhereClause(query: string): string[]` - Parses WHERE conditions
  - `hasAllowFiltering(query: string): boolean` - Detects ALLOW FILTERING
  - `hasLimit(query: string): boolean` - Checks for LIMIT clause

### Formatters
- **Purpose**: Format data for display
- **Functions**:
  - `formatCQL(query: string): string` - Pretty-print CQL with indentation
  - `formatTimestamp(date: Date): string` - Human-readable timestamps
  - `formatBytes(bytes: number): string` - Convert bytes to KB/MB/GB
  - `formatDuration(ms: number): string` - Format query execution time

### Result Exporters
- **Purpose**: Export query results to different formats
- **Functions**:
  - `exportToCSV(results: any[], columns: string[]): string`
  - `exportToJSON(results: any[]): string`
  - `exportToMarkdown(results: any[], columns: string[]): string`

### Type Guards
- **Purpose**: TypeScript type checking utilities
- **Functions**:
  - `isConnectionProfile(obj: any): obj is ConnectionProfile`
  - `isQueryResult(obj: any): obj is QueryResult`
  - `isCassandraError(error: any): error is CassandraError`

### Constants
- **Purpose**: Application-wide constants
- **Exports**:
  - `DEFAULT_PORT = 9042`
  - `DEFAULT_CONSISTENCY_LEVEL = 'QUORUM'`
  - `MAX_QUERY_HISTORY = 50`
  - `CASSANDRA_KEYWORDS = ['SELECT', 'FROM', ...]`

### Logger
- **Purpose**: Centralized logging to VS Code output channel
- **Functions**:
  - `log.info(message: string)` - Info messages
  - `log.warn(message: string)` - Warnings
  - `log.error(message: string, error?: Error)` - Errors with stack traces
  - `log.debug(message: string)` - Debug messages (when enabled)

## Design Principles

When adding utilities:
- **Pure functions**: Utils should be stateless when possible
- **Single purpose**: Each function does one thing well
- **Well-tested**: Utils are perfect candidates for unit testing
- **Documented**: Add JSDoc comments explaining parameters and return values
- **No side effects**: Avoid utils that modify global state
- **Type safety**: Use TypeScript types/interfaces for parameters and return values

## Usage Pattern

Import utils where needed:

```typescript
import { formatCQL, formatDuration } from '../utils/formatters';
import { validateContactPoints } from '../utils/validators';
import { log } from '../utils/logger';
```

## Best Practices

- **Don't duplicate logic**: If you're writing the same code twice, make it a util
- **Keep it simple**: Utils should be easy to understand and use
- **No dependencies on services**: Utils should be low-level, independent helpers
- **Export named functions**: Prefer `export function foo()` over `export default`
