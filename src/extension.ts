/**
 * CassandraLens - VS Code Extension for Apache Cassandra Development
 *
 * This is the main entry point for the extension. VS Code will call the activate()
 * function when the extension is first loaded, and deactivate() when it's unloaded.
 */

import * as vscode from 'vscode';

// Import services
import { CassandraClient } from './services/cassandraClient';
import { ConnectionManager } from './services/connectionManager';
import { ConnectionStorage } from './services/connectionStorage';
import { SchemaService } from './services/schemaService';

// Import commands
import { ConnectionCommands } from './commands/connectionCommands';
import { SchemaCommands } from './commands/schemaCommands';

// Import UI components
import { ConnectionStatusBar } from './ui/statusBar';

// Import providers
import { ConnectionTreeProvider } from './providers/connectionTreeProvider';
import { ConnectionProfile } from './types/connection';

/**
 * Global connection manager instance.
 * Used for cleanup in deactivate().
 */
let connectionManager: ConnectionManager | null = null;

/**
 * Activates the CassandraLens extension.
 *
 * **Initialization Flow:**
 * 1. Create core services (client, storage, manager)
 * 2. Initialize UI components (status bar)
 * 3. Register commands
 * 4. Load and optionally auto-connect to last used connection
 *
 * @param context - The extension context provided by VS Code
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('CassandraLens is now active!');

  // ============================================================================
  // Step 1: Initialize Core Services
  // ============================================================================

  // Create Cassandra client (wraps cassandra-driver)
  const cassandraClient = new CassandraClient();

  // Create connection manager (manages active connection state)
  connectionManager = new ConnectionManager(cassandraClient);

  // Create connection storage (persists connection profiles)
  const connectionStorage = new ConnectionStorage(context);

  // Create schema service (queries Cassandra schema with caching)
  const schemaService = new SchemaService(cassandraClient);

  // Create a separate client for testing connections (doesn't interfere with active connection)
  const testClient = new CassandraClient();

  // ============================================================================
  // Step 2: Initialize Command Handlers
  // ============================================================================

  const connectionCommands = new ConnectionCommands(
    connectionManager,
    connectionStorage,
    testClient,
    context.extensionUri
  );

  // ============================================================================
  // Step 3: Initialize UI Components
  // ============================================================================

  // Create status bar item (shows connection status and allows switching)
  const statusBar = new ConnectionStatusBar(
    connectionManager,
    'cassandra-lens.switchConnection'
  );
  context.subscriptions.push(statusBar);

  // Create connection tree provider (shows connections and schema in sidebar)
  const connectionTreeProvider = new ConnectionTreeProvider(
    connectionStorage,
    connectionManager,
    schemaService
  );

  // Register tree view
  const treeView = vscode.window.createTreeView('cassandraLensConnections', {
    treeDataProvider: connectionTreeProvider,
    showCollapseAll: true // Enable collapse all for schema hierarchy
  });
  context.subscriptions.push(treeView);

  // Create schema commands handler (context menu actions for schema items)
  const schemaCommands = new SchemaCommands(connectionTreeProvider, schemaService);

  // ============================================================================
  // Step 4: Register Commands
  // ============================================================================

  // Connection Management Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('cassandra-lens.addConnection', () =>
      connectionCommands.addConnection()
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('cassandra-lens.switchConnection', () =>
      connectionCommands.switchConnection()
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'cassandra-lens.deleteConnection',
      (treeItem?: any) => {
        // Extract connection from tree item when called from context menu
        const connection = treeItem?.connection || treeItem;
        connectionCommands.deleteConnection(connection);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('cassandra-lens.disconnect', () =>
      connectionCommands.disconnect()
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'cassandra-lens.connectToConnection',
      async (treeItem: any) => {
        // Extract connection from tree item (context menu) or use direct argument
        let connection = treeItem?.connection || treeItem;

        // If no connection provided (called from command palette), show QuickPick
        if (!connection) {
          const connections = await connectionStorage.loadConnections();

          if (connections.length === 0) {
            const addNew = await vscode.window.showInformationMessage(
              'No saved connections. Would you like to add one?',
              'Add Connection'
            );
            if (addNew === 'Add Connection') {
              await connectionCommands.addConnection();
            }
            return;
          }

          const activeProfile = connectionManager?.getActiveProfile();

          const items = connections.map((conn) => ({
            label: `$(database) ${conn.name}`,
            description: conn.contactPoints.join(', '),
            detail: conn.id === activeProfile?.id ? '(Currently connected)' : undefined,
            profile: conn
          }));

          const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a connection'
          });

          if (!selected) {
            return; // User cancelled
          }

          connection = selected.profile;
        }

        // Now we have a connection from either source
        connectionCommands.connectToConnection(connection);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'cassandra-lens.editConnection',
      async (treeItem: any) => {
        // Extract connection from tree item when called from context menu
        let connection = treeItem?.connection || treeItem;

        // If no connection provided (called from command palette), show QuickPick
        if (!connection) {
          const connections = await connectionStorage.loadConnections();

          if (connections.length === 0) {
            vscode.window.showInformationMessage('No saved connections to edit.');
            return;
          }

          const items = connections.map((conn) => ({
            label: conn.name,
            description: conn.contactPoints.join(', '),
            profile: conn
          }));

          const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a connection to edit'
          });

          if (!selected) {
            return; // User cancelled
          }

          connection = selected.profile;
        }

        // Now we have a connection from either source
        connectionCommands.editConnection(connection);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('cassandra-lens.refreshConnections', () =>
      connectionTreeProvider.refresh()
    )
  );

  // Schema Commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'cassandra-lens.copyKeyspaceName',
      (item) => schemaCommands.copyKeyspaceName(item)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'cassandra-lens.copyTableName',
      (item) => schemaCommands.copyTableName(item)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'cassandra-lens.copyColumnName',
      (item) => schemaCommands.copyColumnName(item)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'cassandra-lens.copyColumnPath',
      (item) => schemaCommands.copyColumnPath(item)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'cassandra-lens.browseTableData',
      (item) => schemaCommands.browseTableData(item)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'cassandra-lens.describeTable',
      (item) => schemaCommands.describeTable(item)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'cassandra-lens.refreshNode',
      (item) => schemaCommands.refreshNode(item)
    )
  );

  // ============================================================================
  // Step 5: Auto-Connect to Last Used Connection (Optional)
  // ============================================================================

  // Load saved connections and optionally auto-connect to the most recently used one
  (async () => {
    try {
      const connections = await connectionStorage.loadConnections();

      if (connections.length > 0) {
        // Sort by lastConnectedAt, most recent first
        const sortedConnections = connections.sort((a, b) => {
          const aTime = a.lastConnectedAt?.getTime() || 0;
          const bTime = b.lastConnectedAt?.getTime() || 0;
          return bTime - aTime;
        });

        // Auto-connect to most recently used connection
        const lastUsed = sortedConnections[0];
        if (lastUsed.lastConnectedAt) {
          try {
            await connectionManager.setActiveConnection(lastUsed);
            vscode.window.showInformationMessage(
              `Auto-connected to ${lastUsed.name}`
            );
          } catch (error) {
            console.error('Auto-connect failed:', error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load connections:', error);
    }
  })();

  console.log('CassandraLens activation complete.');
}

/**
 * Deactivates the CassandraLens extension.
 *
 * **Cleanup Tasks:**
 * - Disconnect from active Cassandra connection
 * - Dispose of resources
 *
 * Note: Subscriptions registered via context.subscriptions are automatically
 * disposed by VS Code and don't need manual cleanup here.
 */
export async function deactivate() {
  // Disconnect from active connection if present
  if (connectionManager && connectionManager.isConnected()) {
    try {
      await connectionManager.disconnect();
      console.log('Disconnected from Cassandra during extension deactivation.');
    } catch (error) {
      console.error('Error disconnecting during deactivation:', error);
    }
  }
}
