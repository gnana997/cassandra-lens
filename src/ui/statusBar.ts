/**
 * Connection Status Bar Component
 *
 * Displays the current Cassandra connection status in the VS Code status bar.
 * Provides quick access to connection switching.
 */

import * as vscode from 'vscode';
import { ConnectionManager } from '../services/connectionManager';
import { ConnectionStatus } from '../types/cassandra';

/**
 * Manages the connection status bar item.
 *
 * **Features:**
 * - Shows current connection name or "Disconnected"
 * - Color-coded by connection status (green/gray/red)
 * - Clickable to open connection switcher
 * - Auto-updates when connection state changes
 * - Shows tooltip with cluster details
 *
 * **Status Bar Format:**
 * - Disconnected: `$(database) Cassandra: Disconnected` (gray)
 * - Connecting: `$(sync~spin) Cassandra: Connecting...` (yellow)
 * - Connected: `$(database) Cassandra: Production` (white/green)
 * - Error: `$(error) Cassandra: Error` (red)
 */
export class ConnectionStatusBar {
  /**
   * VS Code status bar item.
   */
  private statusBarItem: vscode.StatusBarItem;

  /**
   * Connection manager to monitor.
   */
  private connectionManager: ConnectionManager;

  /**
   * Creates a new ConnectionStatusBar instance.
   *
   * @param connectionManager - Connection manager to monitor
   * @param switchConnectionCommand - Command ID to invoke when clicked
   */
  constructor(connectionManager: ConnectionManager, switchConnectionCommand: string) {
    this.connectionManager = connectionManager;

    // Create status bar item on the left side with priority 100
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );

    // Make it clickable - opens connection switcher
    this.statusBarItem.command = switchConnectionCommand;

    // Set initial state
    this.updateStatusBar();

    // Listen for connection state changes
    this.connectionManager.on('statusChanged', () => {
      this.updateStatusBar();
    });

    // Show the status bar item
    this.statusBarItem.show();
  }

  /**
   * Updates the status bar item based on current connection state.
   *
   * @private
   */
  private updateStatusBar(): void {
    const status = this.connectionManager.getStatus();
    const profile = this.connectionManager.getActiveProfile();
    const metadata = this.connectionManager.getMetadata();

    switch (status) {
      case ConnectionStatus.Disconnected:
        this.statusBarItem.text = '$(database) Cassandra: Disconnected';
        this.statusBarItem.tooltip = 'Click to connect to a Cassandra cluster';
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.color = new vscode.ThemeColor('statusBar.foreground');
        break;

      case ConnectionStatus.Connecting:
        this.statusBarItem.text = '$(sync~spin) Cassandra: Connecting...';
        this.statusBarItem.tooltip = 'Connecting to Cassandra cluster...';
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.color = new vscode.ThemeColor('statusBar.foreground');
        break;

      case ConnectionStatus.Connected:
        const profileName = profile?.name || 'Unknown';
        this.statusBarItem.text = `$(database) Cassandra: ${profileName}`;

        // Build detailed tooltip
        const tooltipLines: string[] = [
          `Connected to: ${profileName}`,
          '',
          `Cluster: ${metadata?.clusterName || 'Unknown'}`,
          `Version: ${metadata?.cassandraVersion || 'Unknown'}`,
          `Datacenter: ${metadata?.connectedDatacenter || profile?.localDatacenter || 'Unknown'}`,
          `Nodes: ${metadata?.nodeCount || 'Unknown'}`,
          '',
          'Click to switch connections',
        ];
        this.statusBarItem.tooltip = tooltipLines.join('\n');

        // Green background to indicate successful connection
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
        break;

      case ConnectionStatus.Error:
        this.statusBarItem.text = '$(error) Cassandra: Error';
        this.statusBarItem.tooltip =
          'Connection failed. Click to try a different connection.';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor(
          'statusBarItem.errorBackground'
        );
        this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.errorForeground');
        break;

      case ConnectionStatus.Disconnecting:
        this.statusBarItem.text = '$(sync~spin) Cassandra: Disconnecting...';
        this.statusBarItem.tooltip = 'Disconnecting from Cassandra cluster...';
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.color = new vscode.ThemeColor('statusBar.foreground');
        break;
    }
  }

  /**
   * Disposes of the status bar item.
   * Called during extension deactivation.
   */
  dispose(): void {
    this.statusBarItem.dispose();
  }
}
