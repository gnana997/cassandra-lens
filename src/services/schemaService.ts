/**
 * Schema Service
 *
 * Queries Cassandra system schema tables to discover keyspaces, tables, and columns.
 * Implements caching to avoid redundant queries and improve tree view performance.
 */

import * as vscode from 'vscode';
import { CassandraClient } from './cassandraClient';

/**
 * Keyspace metadata from system_schema.keyspaces
 */
export interface KeyspaceInfo {
  name: string;
}

/**
 * Table metadata from system_schema.tables
 */
export interface TableInfo {
  name: string;
}

/**
 * Column metadata from system_schema.columns
 */
export interface ColumnInfo {
  name: string;
  type: string;
  kind: string; // partition_key, clustering, regular, static
  position: number;
}

/**
 * System keyspaces that are typically not interesting to users.
 * These will be filtered out by default (configurable).
 */
const SYSTEM_KEYSPACES = [
  'system',
  'system_schema',
  'system_auth',
  'system_distributed',
  'system_traces',
  'system_virtual_schema',
];

/**
 * Service for querying Cassandra schema metadata with caching.
 */
export class SchemaService {
  /**
   * In-memory cache for schema data.
   * Key format:
   * - "keyspaces" - all keyspaces
   * - "tables:{keyspace}" - tables in keyspace
   * - "columns:{keyspace}:{table}" - columns in table
   */
  private cache: Map<string, any> = new Map();

  /**
   * Creates a new SchemaService.
   *
   * @param cassandraClient - Client for executing CQL queries
   */
  constructor(private readonly cassandraClient: CassandraClient) {}

  /**
   * Checks if schema caching is enabled in user configuration.
   *
   * @private
   * @returns true if caching is enabled (default), false otherwise
   */
  private isCacheEnabled(): boolean {
    const config = vscode.workspace.getConfiguration('cassandraLens');
    return config.get<boolean>('schema.cacheEnabled', true);
  }

  /**
   * Retrieves all keyspaces from the cluster.
   *
   * @param filterSystem - If true, filters out system keyspaces (default: false)
   * @returns Array of keyspace information, sorted alphabetically
   */
  async getKeyspaces(filterSystem: boolean = false): Promise<KeyspaceInfo[]> {
    const cacheKey = 'keyspaces';

    // Check cache first (if caching is enabled)
    if (this.isCacheEnabled() && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      return filterSystem ? this.filterSystemKeyspaces(cached) : cached;
    }

    // Query system schema
    const query = 'SELECT keyspace_name FROM system_schema.keyspaces';

    try {
      const result = await this.cassandraClient.execute(query);

      const keyspaces: KeyspaceInfo[] = result.rows
        .map((row) => ({
          name: row['keyspace_name']?.toString() || '',
        }))
        .filter((ks) => ks.name) // Filter out empty names
        .sort((a, b) => a.name.localeCompare(b.name));

      // Cache the full list (if caching is enabled)
      if (this.isCacheEnabled()) {
        this.cache.set(cacheKey, keyspaces);
      }

      // Return filtered or full list based on parameter
      return filterSystem ? this.filterSystemKeyspaces(keyspaces) : keyspaces;
    } catch (error) {
      console.error('Failed to query keyspaces:', error);
      throw new Error(
        `Failed to load keyspaces: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Retrieves all tables in a keyspace.
   *
   * @param keyspace - Keyspace name
   * @returns Array of table information, sorted alphabetically
   */
  async getTables(keyspace: string): Promise<TableInfo[]> {
    const cacheKey = `tables:${keyspace}`;

    // Check cache first (if caching is enabled)
    if (this.isCacheEnabled() && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Query system schema
    const query = 'SELECT table_name FROM system_schema.tables WHERE keyspace_name = ?';

    try {
      const result = await this.cassandraClient.execute(query, [keyspace]);

      const tables: TableInfo[] = result.rows
        .map((row) => ({
          name: row['table_name']?.toString() || '',
        }))
        .filter((tbl) => tbl.name) // Filter out empty names
        .sort((a, b) => a.name.localeCompare(b.name));

      // Cache the results (if caching is enabled)
      if (this.isCacheEnabled()) {
        this.cache.set(cacheKey, tables);
      }

      return tables;
    } catch (error) {
      console.error(`Failed to query tables in keyspace ${keyspace}:`, error);
      throw new Error(
        `Failed to load tables: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Retrieves all columns for a table.
   *
   * @param keyspace - Keyspace name
   * @param table - Table name
   * @returns Array of column information, sorted by position
   */
  async getColumns(keyspace: string, table: string): Promise<ColumnInfo[]> {
    const cacheKey = `columns:${keyspace}:${table}`;

    // Check cache first (if caching is enabled)
    if (this.isCacheEnabled() && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Query system schema
    const query = `
      SELECT column_name, type, kind, position
      FROM system_schema.columns
      WHERE keyspace_name = ? AND table_name = ?
    `;

    try {
      const result = await this.cassandraClient.execute(query, [keyspace, table]);

      const columns: ColumnInfo[] = result.rows
        .map((row) => ({
          name: row['column_name']?.toString() || '',
          type: row['type']?.toString() || 'unknown',
          kind: row['kind']?.toString() || 'regular',
          position: parseInt(row['position']?.toString() || '0', 10),
        }))
        .filter((col) => col.name) // Filter out empty names
        .sort((a, b) => {
          // Sort by position to maintain schema order
          return a.position - b.position;
        });

      // Cache the results (if caching is enabled)
      if (this.isCacheEnabled()) {
        this.cache.set(cacheKey, columns);
      }

      return columns;
    } catch (error) {
      console.error(`Failed to query columns in ${keyspace}.${table}:`, error);
      throw new Error(
        `Failed to load columns: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Clears all cached schema data.
   * Should be called when user triggers refresh.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clears cached data for a specific keyspace.
   * Clears both tables and columns for that keyspace.
   *
   * @param keyspace - Keyspace name
   */
  clearKeyspaceCache(keyspace: string): void {
    // Clear tables cache for this keyspace
    const tablesKey = `tables:${keyspace}`;
    this.cache.delete(tablesKey);

    // Clear all columns caches for tables in this keyspace
    // We need to iterate and find all keys that start with "columns:{keyspace}:"
    const columnsPrefix = `columns:${keyspace}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(columnsPrefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clears cached data for a specific table.
   *
   * @param keyspace - Keyspace name
   * @param table - Table name
   */
  clearTableCache(keyspace: string, table: string): void {
    const cacheKey = `columns:${keyspace}:${table}`;
    this.cache.delete(cacheKey);
  }

  /**
   * Filters out system keyspaces from a keyspace list.
   *
   * @private
   * @param keyspaces - Array of keyspaces
   * @returns Filtered array without system keyspaces
   */
  private filterSystemKeyspaces(keyspaces: KeyspaceInfo[]): KeyspaceInfo[] {
    return keyspaces.filter((ks) => !SYSTEM_KEYSPACES.includes(ks.name));
  }
}
