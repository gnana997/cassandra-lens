/**
 * Tree Item representing a Cassandra connection in the sidebar.
 *
 * Displays connection name, status icon, and contact points.
 * Provides context values for conditional menu items.
 */

import * as vscode from 'vscode';
import { ConnectionProfile } from '../types/connection';

export class ConnectionTreeItem extends vscode.TreeItem {
  /**
   * Creates a tree item for a connection profile.
   *
   * @param connection - The connection profile to display
   * @param isActive - Whether this connection is currently active
   * @param isError - Whether this connection is in error state
   */
  constructor(
    public readonly connection: ConnectionProfile,
    public readonly isActive: boolean,
    public readonly isError: boolean = false
  ) {
    super(connection.name, vscode.TreeItemCollapsibleState.None);

    // Set description (shows next to name in tree)
    this.description = connection.contactPoints.join(', ');

    // Set tooltip with full details
    this.tooltip = this.buildTooltip();

    // Set icon based on connection state
    this.iconPath = this.getIcon();

    // Set context value for conditional menu items
    if (isError) {
      this.contextValue = 'connection-error';
    } else if (isActive) {
      this.contextValue = 'connection-connected';
    } else {
      this.contextValue = 'connection-disconnected';
    }

    // Set command to execute when clicked (connect to connection)
    if (!isActive) {
      this.command = {
        command: 'cassandra-lens.connectToConnection',
        title: 'Connect to Cassandra',
        arguments: [connection]
      };
    }
  }

  /**
   * Builds a detailed tooltip showing connection information.
   */
  private buildTooltip(): string {
    const lines = [
      `Connection: ${this.connection.name}`,
      `Contact Points: ${this.connection.contactPoints.join(', ')}`,
      `Port: ${this.connection.port}`,
      `Datacenter: ${this.connection.localDatacenter}`,
    ];

    if (this.connection.keyspace) {
      lines.push(`Keyspace: ${this.connection.keyspace}`);
    }

    if (this.connection.auth?.enabled) {
      lines.push(`Authentication: ${this.connection.auth.username}`);
    }

    if (this.connection.ssl?.enabled) {
      lines.push(`SSL: Enabled`);
    }

    if (this.isActive) {
      lines.push('', 'Status: Connected');
    } else if (this.isError) {
      lines.push('', 'Status: Error');
    } else {
      lines.push('', 'Click to connect');
    }

    return lines.join('\n');
  }

  /**
   * Returns the appropriate icon based on connection state.
   */
  private getIcon(): vscode.ThemeIcon {
    if (this.isError) {
      return new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
    } else if (this.isActive) {
      return new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
    } else {
      return new vscode.ThemeIcon('database');
    }
  }
}
