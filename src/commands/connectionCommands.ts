/**
 * Connection Command Handlers
 *
 * Implements command handlers for connection management:
 * - Add new connection (multi-step form)
 * - Switch between connections
 * - Edit existing connection
 * - Delete connection
 * - Test connection before saving
 */

import * as vscode from 'vscode';
import { ConnectionManager } from '../services/connectionManager';
import { ConnectionStorage } from '../services/connectionStorage';
import { CassandraClient } from '../services/cassandraClient';
import { ConnectionFormPanel } from '../webviews/ConnectionFormPanel';
import { ConnectionProfile } from '../types/connection';

/**
 * Command handlers for connection management.
 */
export class ConnectionCommands {
  constructor(
    private readonly connectionManager: ConnectionManager,
    private readonly connectionStorage: ConnectionStorage,
    private readonly testClient: CassandraClient,
    private readonly extensionUri: vscode.Uri
  ) {}

  /**
   * Command: Add New Connection
   *
   * Opens a webview form to collect connection details and save.
   */
  async addConnection(): Promise<void> {
    ConnectionFormPanel.createOrShow(
      this.extensionUri,
      undefined, // No existing profile (new connection)
      // onSave callback
      async (profile: Partial<ConnectionProfile>) => {
        try {
          // Generate ID for new connection
          const { v4: uuidv4 } = await import('uuid');
          const newProfile: ConnectionProfile = {
            id: uuidv4(),
            name: profile.name || 'Unnamed Connection',
            contactPoints: profile.contactPoints || [],
            port: profile.port || 9042,
            localDatacenter: profile.localDatacenter || 'datacenter1',
            keyspace: profile.keyspace,
            auth: profile.auth || { enabled: false },
            ssl: profile.ssl || { enabled: false },
            socket: profile.socket || {},
            createdAt: new Date(),
          };

          // Save the connection
          await this.connectionStorage.saveConnection(newProfile);

          vscode.window.showInformationMessage(
            `Connection "${newProfile.name}" saved successfully!`
          );

          // Ask if user wants to connect now
          const connectNow = await vscode.window.showQuickPick(['Yes', 'No'], {
            placeHolder: 'Connect to this cluster now?',
          });

          if (connectNow === 'Yes') {
            await this.connectToProfile(newProfile);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          vscode.window.showErrorMessage(`Failed to save connection: ${message}`);
          throw error; // Re-throw to show error in webview
        }
      },
      // onTest callback
      async (profile: Partial<ConnectionProfile>) => {
        try {
          const testProfile: ConnectionProfile = {
            id: 'test',
            name: profile.name || 'Test',
            contactPoints: profile.contactPoints || [],
            port: profile.port || 9042,
            localDatacenter: profile.localDatacenter || 'datacenter1',
            keyspace: profile.keyspace,
            auth: profile.auth || { enabled: false },
            ssl: profile.ssl || { enabled: false },
            socket: profile.socket || {},
            createdAt: new Date(),
          };

          const result = await this.testClient.testConnection(testProfile);

          if (result.success) {
            const version = result.metadata?.cassandraVersion || 'Unknown';
            const cluster = result.metadata?.clusterName || 'Unknown';
            return {
              success: true,
              message: `Connected successfully!\nCluster: ${cluster}\nVersion: ${version}\nTime: ${result.connectionTimeMs}ms`
            };
          } else {
            return {
              success: false,
              message: result.errorMessage || 'Connection test failed'
            };
          }
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : 'Connection test failed'
          };
        }
      }
    );
  }

  /**
   * Command: Switch Connection
   *
   * Shows a QuickPick to select and switch to a different connection.
   */
  async switchConnection(): Promise<void> {
    try {
      const connections = await this.connectionStorage.loadConnections();

      if (connections.length === 0) {
        const addNew = await vscode.window.showInformationMessage(
          'No saved connections. Would you like to add one?',
          'Add Connection'
        );
        if (addNew === 'Add Connection') {
          await this.addConnection();
        }
        return;
      }

      const activeProfile = this.connectionManager.getActiveProfile();

      const items = connections.map((conn) => ({
        label: `$(database) ${conn.name}`,
        description: conn.contactPoints.join(', '),
        detail: conn.id === activeProfile?.id ? '(Currently connected)' : undefined,
        profile: conn,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a connection',
      });

      if (selected) {
        await this.connectToProfile(selected.profile);
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to switch connection: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Connects to a specific profile with progress indication.
   */
  private async connectToProfile(profile: ConnectionProfile): Promise<void> {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Connecting to ${profile.name}...`,
        cancellable: false,
      },
      async (progress) => {
        progress.report({ increment: 0 });

        try {
          const metadata = await this.connectionManager.setActiveConnection(profile);

          // Update last connected timestamp
          await this.connectionStorage.updateLastConnectedTimestamp(profile.id);

          const version = metadata.cassandraVersion || 'Unknown';
          const cluster = metadata.clusterName || profile.name;

          vscode.window.showInformationMessage(
            `Connected to ${cluster} (Cassandra ${version})`
          );
        } catch (error) {
          throw error;
        }
      }
    );
  }

  /**
   * Command: Connect to Connection
   *
   * Connects to a specific connection profile (invoked from tree view).
   *
   * @param connection - The connection profile to connect to
   */
  async connectToConnection(connection: ConnectionProfile): Promise<void> {
    try {
      await this.connectToProfile(connection);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Command: Edit Connection
   *
   * Edits an existing connection profile (invoked from tree view).
   * Opens the webview form pre-filled with existing values.
   *
   * @param connection - The connection profile to edit
   */
  async editConnection(connection: ConnectionProfile): Promise<void> {
    ConnectionFormPanel.createOrShow(
      this.extensionUri,
      connection, // Pass existing profile to pre-fill form
      // onSave callback
      async (profile: Partial<ConnectionProfile>) => {
        try {
          // Merge updates with existing connection (preserve ID, createdAt, and lastConnectedAt)
          const updatedProfile: ConnectionProfile = {
            ...connection, // Start with existing profile
            name: profile.name || connection.name,
            contactPoints: profile.contactPoints || connection.contactPoints,
            port: profile.port || connection.port,
            localDatacenter: profile.localDatacenter || connection.localDatacenter,
            keyspace: profile.keyspace,
            auth: profile.auth || connection.auth,
            ssl: profile.ssl || connection.ssl,
            socket: profile.socket || connection.socket,
            lastModifiedAt: new Date(),
          };

          // Save the connection (will update existing due to same ID)
          await this.connectionStorage.saveConnection(updatedProfile);

          vscode.window.showInformationMessage(
            `Connection "${updatedProfile.name}" updated successfully!`
          );

          // If this was the active connection, reconnect with new settings
          const activeProfile = this.connectionManager.getActiveProfile();
          if (activeProfile?.id === updatedProfile.id && this.connectionManager.isConnected()) {
            const reconnect = await vscode.window.showQuickPick(['Yes', 'No'], {
              placeHolder: 'Reconnect with new settings?',
            });

            if (reconnect === 'Yes') {
              await this.connectionManager.disconnect();
              await this.connectToProfile(updatedProfile);
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          vscode.window.showErrorMessage(`Failed to update connection: ${message}`);
          throw error; // Re-throw to show error in webview
        }
      },
      // onTest callback
      async (profile: Partial<ConnectionProfile>) => {
        try {
          const testProfile: ConnectionProfile = {
            ...connection,
            name: profile.name || connection.name,
            contactPoints: profile.contactPoints || connection.contactPoints,
            port: profile.port || connection.port,
            localDatacenter: profile.localDatacenter || connection.localDatacenter,
            keyspace: profile.keyspace,
            auth: profile.auth || connection.auth,
            ssl: profile.ssl || connection.ssl,
          };

          const result = await this.testClient.testConnection(testProfile);

          if (result.success) {
            const version = result.metadata?.cassandraVersion || 'Unknown';
            const cluster = result.metadata?.clusterName || 'Unknown';
            return {
              success: true,
              message: `Connected successfully!\nCluster: ${cluster}\nVersion: ${version}\nTime: ${result.connectionTimeMs}ms`
            };
          } else {
            return {
              success: false,
              message: result.errorMessage || 'Connection test failed'
            };
          }
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : 'Connection test failed'
          };
        }
      }
    );
  }

  /**
   * Command: Delete Connection
   *
   * Shows a QuickPick to select and delete a connection,
   * or deletes a specific connection if provided (from tree view).
   *
   * @param connection - Optional connection to delete (from context menu)
   */
  async deleteConnection(connection?: ConnectionProfile): Promise<void> {
    try {
      let profileToDelete: ConnectionProfile | undefined = connection;

      // If no connection provided, show QuickPick to select one
      if (!profileToDelete) {
        const connections = await this.connectionStorage.loadConnections();

        if (connections.length === 0) {
          vscode.window.showInformationMessage('No saved connections to delete.');
          return;
        }

        const items = connections.map((conn) => ({
          label: conn.name,
          description: conn.contactPoints.join(', '),
          profile: conn,
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select a connection to delete',
        });

        if (!selected) {
          return; // User cancelled
        }

        profileToDelete = selected.profile;
      }

      // Confirm deletion
      const confirm = await vscode.window.showWarningMessage(
        `Delete connection "${profileToDelete.name}"?`,
        { modal: true },
        'Delete'
      );

      if (confirm === 'Delete') {
        // Disconnect if this is the active connection
        const activeProfile = this.connectionManager.getActiveProfile();
        if (activeProfile?.id === profileToDelete.id) {
          await this.connectionManager.disconnect();
        }

        await this.connectionStorage.deleteConnection(profileToDelete.id);
        vscode.window.showInformationMessage(
          `Connection "${profileToDelete.name}" deleted.`
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to delete connection: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Command: Disconnect
   *
   * Disconnects from the active connection.
   */
  async disconnect(): Promise<void> {
    try {
      if (!this.connectionManager.isConnected()) {
        vscode.window.showInformationMessage('Not currently connected.');
        return;
      }

      await this.connectionManager.disconnect();
      vscode.window.showInformationMessage('Disconnected from Cassandra.');
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to disconnect: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
