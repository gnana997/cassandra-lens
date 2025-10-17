/**
 * Tree Data Provider for Cassandra Connections and Schema
 *
 * Displays all saved connection profiles in the VS Code sidebar.
 * For active connections, displays the hierarchical schema:
 * Connection -> Keyspaces -> Tables -> Columns
 *
 * Automatically refreshes when connections are added/modified/deleted
 * or when connection status changes.
 */

import * as vscode from 'vscode';
import { ConnectionTreeItem } from './connectionTreeItem';
import { KeyspaceTreeItem } from './keyspaceTreeItem';
import { TableTreeItem } from './tableTreeItem';
import { ColumnTreeItem } from './columnTreeItem';
import { SchemaTreeItem } from './schemaTreeItem';
import { ConnectionStorage } from '../services/connectionStorage';
import { ConnectionManager } from '../services/connectionManager';
import { SchemaService } from '../services/schemaService';
import { ConnectionProfile } from '../types/connection';

export class ConnectionTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  /**
   * Event emitter for tree refresh.
   * Fires when tree data changes and view needs to be updated.
   */
  private _onDidChangeTreeData = new vscode.EventEmitter<
    vscode.TreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  /**
   * Creates a new ConnectionTreeProvider.
   *
   * @param connectionStorage - Service for loading saved connections
   * @param connectionManager - Service for managing active connection
   * @param schemaService - Service for querying Cassandra schema
   */
  constructor(
    private readonly connectionStorage: ConnectionStorage,
    private readonly connectionManager: ConnectionManager,
    private readonly schemaService: SchemaService
  ) {
    // Subscribe to connection manager events to auto-refresh tree
    this.connectionManager.on('statusChanged', () => {
      this.refresh();
    });

    this.connectionManager.on('connected', () => {
      this.refresh();
    });

    this.connectionManager.on('disconnected', () => {
      this.refresh();
    });
  }

  /**
   * Refreshes the tree view.
   * Can refresh entire tree or a specific node and its children.
   *
   * @param element - Optional tree item to refresh (refreshes entire tree if undefined)
   */
  refresh(element?: vscode.TreeItem): void {
    // Clear appropriate cache based on element type
    if (element instanceof SchemaTreeItem) {
      if (element instanceof ColumnTreeItem) {
        // Columns are leaf nodes, clear their table's cache
        this.schemaService.clearTableCache(element.keyspace, element.table);
      } else if (element instanceof TableTreeItem) {
        // Clear cache for this table's columns
        this.schemaService.clearTableCache(element.keyspace, element.table);
      } else if (element instanceof KeyspaceTreeItem) {
        // Clear cache for this keyspace (tables and columns)
        this.schemaService.clearKeyspaceCache(element.keyspace);
      }
    } else if (element instanceof ConnectionTreeItem || !element) {
      // Connection-level refresh or full refresh - clear all schema cache
      this.schemaService.clearCache();
    }

    this._onDidChangeTreeData.fire(element);
  }

  /**
   * Returns the TreeItem representation for display in VS Code.
   *
   * @param element - The tree item to render
   * @returns The tree item
   */
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Returns the children of a tree element.
   *
   * @param element - The parent element (undefined for root)
   * @returns Array of child tree items
   */
  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      // Root level - return all connections
      return this.getConnections();
    }

    // Handle different node types
    if (element instanceof ConnectionTreeItem) {
      // Connection expanded - show keyspaces if connected
      if (element.isActive) {
        return this.getKeyspaces(element.connection);
      }
      return [];
    }

    if (element instanceof KeyspaceTreeItem) {
      // Keyspace expanded - show tables
      return this.getTables(element.keyspace);
    }

    if (element instanceof TableTreeItem) {
      // Table expanded - show columns
      return this.getColumns(element.keyspace, element.table);
    }

    if (element instanceof ColumnTreeItem) {
      // Columns are leaf nodes - no children
      return [];
    }

    return [];
  }

  /**
   * Loads all saved connections and converts them to tree items.
   *
   * @returns Array of connection tree items
   */
  private async getConnections(): Promise<ConnectionTreeItem[]> {
    try {
      const connections = await this.connectionStorage.loadConnections();

      if (connections.length === 0) {
        return [];
      }

      // Get active connection ID
      const activeProfile = this.connectionManager.getActiveProfile();
      const activeId = activeProfile?.id;

      // Check if there's an error state
      const isError = !this.connectionManager.isConnected() && activeProfile !== null;

      // Convert connections to tree items
      return connections.map((connection) => {
        const isActive = connection.id === activeId && this.connectionManager.isConnected();
        const hasError = connection.id === activeId && isError;

        return new ConnectionTreeItem(connection, isActive, hasError);
      });
    } catch (error) {
      console.error('Failed to load connections for tree view:', error);
      vscode.window.showErrorMessage(
        `Failed to load connections: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return [];
    }
  }

  /**
   * Fetches keyspaces for a connection and converts them to tree items.
   *
   * @param connection - The connection profile
   * @returns Array of keyspace tree items
   */
  private async getKeyspaces(connection: ConnectionProfile): Promise<KeyspaceTreeItem[]> {
    try {
      // Read configuration setting (default: false = show system keyspaces for development)
      const config = vscode.workspace.getConfiguration('cassandraLens');
      const filterSystem = config.get<boolean>('schema.filterSystemKeyspaces', false);

      const keyspaces = await this.schemaService.getKeyspaces(filterSystem);
      return keyspaces.map((ks) => new KeyspaceTreeItem(ks.name));
    } catch (error) {
      console.error('Failed to load keyspaces for tree view:', error);
      vscode.window.showErrorMessage(
        `Failed to load keyspaces: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return [];
    }
  }

  /**
   * Fetches tables for a keyspace and converts them to tree items.
   *
   * @param keyspace - The keyspace name
   * @returns Array of table tree items
   */
  private async getTables(keyspace: string): Promise<TableTreeItem[]> {
    try {
      const tables = await this.schemaService.getTables(keyspace);
      return tables.map((tbl) => new TableTreeItem(keyspace, tbl.name));
    } catch (error) {
      console.error(`Failed to load tables for keyspace ${keyspace}:`, error);
      vscode.window.showErrorMessage(
        `Failed to load tables: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return [];
    }
  }

  /**
   * Fetches columns for a table and converts them to tree items.
   *
   * @param keyspace - The keyspace name
   * @param table - The table name
   * @returns Array of column tree items
   */
  private async getColumns(keyspace: string, table: string): Promise<ColumnTreeItem[]> {
    try {
      const columns = await this.schemaService.getColumns(keyspace, table);
      return columns.map(
        (col) => new ColumnTreeItem(keyspace, table, col.name, col.type, col.kind)
      );
    } catch (error) {
      console.error(`Failed to load columns for ${keyspace}.${table}:`, error);
      vscode.window.showErrorMessage(
        `Failed to load columns: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return [];
    }
  }

  /**
   * Returns a specific connection profile by ID.
   * Useful for command handlers that receive a connection ID.
   *
   * @param connectionId - The connection ID to find
   * @returns The connection profile or undefined if not found
   */
  async getConnection(connectionId: string): Promise<ConnectionProfile | undefined> {
    const connections = await this.connectionStorage.loadConnections();
    return connections.find((conn) => conn.id === connectionId);
  }
}
