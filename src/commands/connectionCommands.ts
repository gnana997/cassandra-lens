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
import { MultiStepInput } from '../utils/multiStepInput';
import {
  validateConnectionName,
  validateContactPoints,
  validatePort,
  validateDatacenter,
  validateKeyspaceName,
  validateUsername,
  validatePassword,
  validateOptionalFilePath,
  validateTimeout,
} from '../utils/validators';
import { ConnectionProfile, AuthConfig, SslConfig, SocketConfig } from '../types/connection';

/**
 * Temporary state object used during connection creation flow.
 */
interface ConnectionFormState {
  profile: Partial<ConnectionProfile>;
  step: number;
}

/**
 * Command handlers for connection management.
 */
export class ConnectionCommands {
  constructor(
    private readonly connectionManager: ConnectionManager,
    private readonly connectionStorage: ConnectionStorage,
    private readonly testClient: CassandraClient
  ) {}

  /**
   * Command: Add New Connection
   *
   * Opens a multi-step form to collect connection details,
   * tests the connection, and saves it.
   */
  async addConnection(): Promise<void> {
    const state: ConnectionFormState = {
      profile: {
        port: 9042,
        auth: { enabled: false },
        ssl: { enabled: false },
        socket: {},
      },
      step: 1,
    };

    try {
      await MultiStepInput.run((input) => this.collectConnectionName(input, state));

      // After flow completes, we have a complete profile
      const profile = state.profile as ConnectionProfile;

      // Save the connection
      await this.connectionStorage.saveConnection(profile);

      vscode.window.showInformationMessage(
        `Connection "${profile.name}" saved successfully!`
      );

      // Ask if user wants to connect now
      const connectNow = await vscode.window.showQuickPick(['Yes', 'No'], {
        placeHolder: 'Connect to this cluster now?',
      });

      if (connectNow === 'Yes') {
        await this.connectToProfile(profile);
      }
    } catch (error) {
      // User cancelled or error occurred
      if (error instanceof Error && error.message !== 'User cancelled') {
        vscode.window.showErrorMessage(`Failed to add connection: ${error.message}`);
      }
    }
  }

  /**
   * Step 1: Collect connection name
   */
  private async collectConnectionName(
    input: MultiStepInput,
    state: ConnectionFormState
  ): Promise<any> {
    const name = await input.showInputBox({
      title: 'Add Cassandra Connection (1/7)',
      step: 1,
      totalSteps: 7,
      placeholder: 'Production Cluster',
      prompt: 'Enter a name for this connection',
      validate: async (value) => validateConnectionName(value),
    });

    state.profile.name = name;
    return (input: MultiStepInput) => this.collectContactPoints(input, state);
  }

  /**
   * Step 2: Collect contact points
   */
  private async collectContactPoints(
    input: MultiStepInput,
    state: ConnectionFormState
  ): Promise<any> {
    const contactPointsStr = await input.showInputBox({
      title: 'Add Cassandra Connection (2/7)',
      step: 2,
      totalSteps: 7,
      placeholder: '10.0.1.10,10.0.1.11,10.0.1.12',
      prompt: 'Enter contact points (comma-separated IP addresses or hostnames)',
      validate: async (value) => validateContactPoints(value),
    });

    state.profile.contactPoints = contactPointsStr.split(',').map((cp) => cp.trim());
    return (input: MultiStepInput) => this.collectPort(input, state);
  }

  /**
   * Step 3: Collect port number
   */
  private async collectPort(input: MultiStepInput, state: ConnectionFormState): Promise<any> {
    const portStr = await input.showInputBox({
      title: 'Add Cassandra Connection (3/7)',
      step: 3,
      totalSteps: 7,
      value: '9042',
      placeholder: '9042',
      prompt: 'Enter Cassandra native protocol port',
      validate: async (value) => validatePort(value),
    });

    state.profile.port = parseInt(portStr, 10);
    return (input: MultiStepInput) => this.collectDatacenter(input, state);
  }

  /**
   * Step 4: Collect local datacenter name
   */
  private async collectDatacenter(
    input: MultiStepInput,
    state: ConnectionFormState
  ): Promise<any> {
    const datacenter = await input.showInputBox({
      title: 'Add Cassandra Connection (4/7)',
      step: 4,
      totalSteps: 7,
      placeholder: 'datacenter1',
      prompt: 'Enter local datacenter name (required by driver load balancing)',
      validate: async (value) => validateDatacenter(value),
    });

    state.profile.localDatacenter = datacenter;

    // Optional: Ask for default keyspace
    return (input: MultiStepInput) => this.collectKeyspace(input, state);
  }

  /**
   * Step 4.5: Collect optional default keyspace
   */
  private async collectKeyspace(
    input: MultiStepInput,
    state: ConnectionFormState
  ): Promise<any> {
    const keyspace = await input.showInputBox({
      title: 'Add Cassandra Connection (5/7)',
      step: 5,
      totalSteps: 7,
      placeholder: '(optional)',
      prompt: 'Enter default keyspace (optional, press Enter to skip)',
      validate: async (value) => validateKeyspaceName(value),
    });

    if (keyspace && keyspace.trim().length > 0) {
      state.profile.keyspace = keyspace;
    }

    return (input: MultiStepInput) => this.askEnableAuth(input, state);
  }

  /**
   * Step 5: Ask if authentication is needed
   */
  private async askEnableAuth(
    input: MultiStepInput,
    state: ConnectionFormState
  ): Promise<any> {
    const enableAuth = await input.showQuickPick({
      title: 'Add Cassandra Connection (6/7)',
      step: 6,
      totalSteps: 7,
      placeholder: 'Does this cluster require authentication?',
      items: [
        { label: 'Yes', description: 'Username and password required' },
        { label: 'No', description: 'Anonymous connection' },
      ],
    });

    if (enableAuth.label === 'Yes') {
      state.profile.auth = { enabled: true };
      return (input: MultiStepInput) => this.collectUsername(input, state);
    } else {
      state.profile.auth = { enabled: false };
      return (input: MultiStepInput) => this.askEnableSSL(input, state);
    }
  }

  /**
   * Step 5a: Collect username (if auth enabled)
   */
  private async collectUsername(
    input: MultiStepInput,
    state: ConnectionFormState
  ): Promise<any> {
    const username = await input.showInputBox({
      title: 'Add Cassandra Connection - Authentication',
      step: 6,
      totalSteps: 7,
      placeholder: 'cassandra',
      prompt: 'Enter username',
      validate: async (value) => validateUsername(value),
    });

    state.profile.auth!.username = username;
    return (input: MultiStepInput) => this.collectPassword(input, state);
  }

  /**
   * Step 5b: Collect password (if auth enabled)
   */
  private async collectPassword(
    input: MultiStepInput,
    state: ConnectionFormState
  ): Promise<any> {
    const password = await input.showInputBox({
      title: 'Add Cassandra Connection - Authentication',
      step: 6,
      totalSteps: 7,
      placeholder: '********',
      prompt: 'Enter password',
      password: true,
      validate: async (value) => validatePassword(value),
    });

    state.profile.auth!.password = password;
    return (input: MultiStepInput) => this.askEnableSSL(input, state);
  }

  /**
   * Step 6: Ask if SSL is needed
   */
  private async askEnableSSL(input: MultiStepInput, state: ConnectionFormState): Promise<any> {
    const enableSSL = await input.showQuickPick({
      title: 'Add Cassandra Connection (7/7)',
      step: 7,
      totalSteps: 7,
      placeholder: 'Enable SSL/TLS encryption?',
      items: [
        { label: 'No', description: 'Unencrypted connection (for local development)' },
        { label: 'Yes', description: 'Encrypted connection with SSL/TLS' },
      ],
    });

    if (enableSSL.label === 'Yes') {
      state.profile.ssl = { enabled: true, rejectUnauthorized: true };
      return (input: MultiStepInput) => this.collectSSLCertPath(input, state);
    } else {
      state.profile.ssl = { enabled: false };
      return (input: MultiStepInput) => this.confirmAndTest(input, state);
    }
  }

  /**
   * Step 6a: Collect SSL certificate path (if SSL enabled)
   */
  private async collectSSLCertPath(
    input: MultiStepInput,
    state: ConnectionFormState
  ): Promise<any> {
    const caCertPath = await input.showInputBox({
      title: 'Add Cassandra Connection - SSL Configuration',
      step: 7,
      totalSteps: 7,
      placeholder: '/path/to/ca-cert.pem (optional)',
      prompt: 'Enter path to CA certificate (optional, press Enter to skip)',
      validate: async (value) => validateOptionalFilePath(value, 'CA certificate'),
    });

    if (caCertPath && caCertPath.trim().length > 0) {
      state.profile.ssl!.caCertPath = caCertPath;
    }

    return (input: MultiStepInput) => this.confirmAndTest(input, state);
  }

  /**
   * Step 7: Confirm and test connection
   */
  private async confirmAndTest(
    input: MultiStepInput,
    state: ConnectionFormState
  ): Promise<any> {
    const action = await input.showQuickPick({
      title: 'Add Cassandra Connection - Ready',
      step: 7,
      totalSteps: 7,
      placeholder: 'Connection configured. What would you like to do?',
      items: [
        {
          label: '$(cloud-upload) Test & Save',
          description: 'Test connection before saving',
        },
        {
          label: '$(save) Save Without Testing',
          description: 'Save connection without testing',
        },
      ],
      canGoBack: true,
    });

    if (action.label.includes('Test & Save')) {
      await this.testConnectionBeforeSave(state.profile as ConnectionProfile);
    }

    // Return undefined to end the flow
    return undefined;
  }

  /**
   * Tests a connection configuration before saving.
   */
  private async testConnectionBeforeSave(profile: ConnectionProfile): Promise<void> {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Testing connection to ${profile.name}...`,
        cancellable: false,
      },
      async (progress) => {
        progress.report({ increment: 0, message: 'Connecting...' });

        const result = await this.testClient.testConnection(profile);

        if (result.success) {
          progress.report({ increment: 100, message: 'Success!' });
          const version = result.metadata?.cassandraVersion || 'Unknown';
          const cluster = result.metadata?.clusterName || 'Unknown';
          vscode.window.showInformationMessage(
            `✓ Connection successful!\n` +
              `Cluster: ${cluster}\n` +
              `Version: ${version}\n` +
              `Time: ${result.connectionTimeMs}ms`
          );
        } else {
          throw new Error(result.errorMessage || 'Connection test failed');
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
   * Command: Delete Connection
   *
   * Shows a QuickPick to select and delete a connection.
   */
  async deleteConnection(): Promise<void> {
    try {
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

      if (selected) {
        const confirm = await vscode.window.showWarningMessage(
          `Delete connection "${selected.profile.name}"?`,
          { modal: true },
          'Delete'
        );

        if (confirm === 'Delete') {
          // Disconnect if this is the active connection
          const activeProfile = this.connectionManager.getActiveProfile();
          if (activeProfile?.id === selected.profile.id) {
            await this.connectionManager.disconnect();
          }

          await this.connectionStorage.deleteConnection(selected.profile.id);
          vscode.window.showInformationMessage(
            `Connection "${selected.profile.name}" deleted.`
          );
        }
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
