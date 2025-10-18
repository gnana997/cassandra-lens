/**
 * Type definitions for Query Results webview
 */

/**
 * Query result metadata and rows
 */
export interface QueryResult {
  /** Column metadata */
  columns: ColumnMetadata[];
  /** Result rows */
  rows: any[];
  /** Execution time in milliseconds */
  executionTime: number;
  /** Keyspace.table path */
  tablePath?: string;
  /** Query statement that was executed */
  query: string;
}

/**
 * Column metadata from Cassandra ResultSet
 */
export interface ColumnMetadata {
  name: string;
  type: string;
}

/**
 * Query execution error
 */
export interface QueryError {
  message: string;
  suggestion?: string;
  query: string;
}

/**
 * Message types sent from extension to webview
 */
export type MessageToWebview =
  | { type: 'executing'; query: string }
  | { type: 'results'; data: QueryResult; defaultPageSize?: number }
  | { type: 'error'; error: QueryError };

/**
 * Message types sent from webview to extension
 */
export interface MessageFromWebview {
  type: 'ready' | 'export' | 'copyCell';
  format?: 'csv' | 'json';
  data?: any;
}

/**
 * Application state
 */
export interface AppState {
  status: 'idle' | 'executing' | 'results' | 'error';
  currentQuery?: string;
  result?: QueryResult;
  error?: QueryError;
  viewMode: 'table' | 'json';
  currentPage: number;
  rowsPerPage: number;
  sortColumn?: string;
  sortDirection: 'asc' | 'desc';
}
