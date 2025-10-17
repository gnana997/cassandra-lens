/**
 * Tree Data Provider for Cassandra Connections
 *
 * Displays all saved connection profiles in the VS Code sidebar.
 * Automatically refreshes when connections are added/modified/deleted
 * or when connection status changes.
 */

import * as vscode from 'vscode';
import { ConnectionTreeItem } from './connectionTreeItem';
import { ConnectionStorage } from '../services/connectionStorage';
import { ConnectionManager } from '../services/connectionManager';
import { ConnectionProfile } from '../types/connection';

export class ConnectionTreeProvider implements vscode.TreeDataProvider<ConnectionTreeItem> {
  /**
   * Event emitter for tree refresh.
   * Fires when tree data changes and view needs to be updated.
   */
  private _onDidChangeTreeData = new vscode.EventEmitter<
    ConnectionTreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  /**
   * Creates a new ConnectionTreeProvider.
   *
   * @param connectionStorage - Service for loading saved connections
   * @param connectionManager - Service for managing active connection
   */
  constructor(
    private readonly connectionStorage: ConnectionStorage,
    private readonly connectionManager: ConnectionManager
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
   * Refreshes the entire tree view.
   * Called when connections are added/modified/deleted or status changes.
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Returns the TreeItem representation for display in VS Code.
   *
   * @param element - The tree item to render
   * @returns The tree item
   */
  getTreeItem(element: ConnectionTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Returns the children of a tree element.
   *
   * @param element - The parent element (undefined for root)
   * @returns Array of child tree items
   */
  async getChildren(element?: ConnectionTreeItem): Promise<ConnectionTreeItem[]> {
    if (!element) {
      // Root level - return all connections
      return this.getConnections();
    }

    // No children for connection items in Week 1 scope
    // Week 2 will expand this to show keyspaces, tables, columns
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
