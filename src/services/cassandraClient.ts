/**
 * Cassandra Client Service
 *
 * Wraps the DataStax cassandra-driver with CassandraLens-specific configuration,
 * error handling, and convenience methods.
 */

import * as cassandra from 'cassandra-driver';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { ConnectionProfile } from '../types/connection';
import {
  ConnectionTestResult,
  ConnectionMetadata,
  CassandraErrorType,
} from '../types/cassandra';

/**
 * Service class that manages Cassandra database connections.
 *
 * **Features:**
 * - Wraps cassandra-driver Client with extension-specific logic
 * - Configures authentication via PlainTextAuthProvider
 * - Supports SSL/TLS encrypted connections
 * - Provides user-friendly error messages
 * - Manages connection lifecycle (connect → query → disconnect)
 *
 * **Driver Version:** cassandra-driver v4.8.0
 * - Built-in TypeScript support
 * - Auto-managed connection pooling (1 connection per host for modern Cassandra)
 */
export class CassandraClient {
  /**
   * Active cassandra-driver Client instance.
   * Null when not connected.
   */
  private client: cassandra.Client | null = null;

  /**
   * Profile used for the current connection.
   * Stored for reference and reconnection logic.
   */
  private currentProfile: ConnectionProfile | null = null;

  /**
   * Connects to a Cassandra cluster using the provided profile.
   *
   * @param profile - Complete connection configuration
   * @returns Metadata about the connected cluster
   * @throws Error if connection fails
   */
  async connect(profile: ConnectionProfile): Promise<ConnectionMetadata> {
    try {
      // Close existing connection if present
      if (this.client) {
        await this.disconnect();
      }

      // Build client options from profile
      const clientOptions = this.buildClientOptions(profile);

      // Create and connect client
      this.client = new cassandra.Client(clientOptions);
      this.currentProfile = profile;

      // Establish connection
      await this.client.connect();

      // Retrieve cluster metadata
      const metadata = await this.getConnectionMetadata();

      return metadata;
    } catch (error) {
      this.client = null;
      this.currentProfile = null;
      throw this.handleError(error);
    }
  }

  /**
   * Tests a connection without keeping it alive.
   * Used during connection form to validate credentials and network.
   *
   * @param profile - Connection configuration to test
   * @param timeoutMs - Test timeout in milliseconds (default: 15000)
   * @returns Test result with success status and metadata
   */
  async testConnection(
    profile: ConnectionProfile,
    timeoutMs: number = 15000
  ): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    let testClient: cassandra.Client | null = null;

    try {
      // Build client options with custom timeout
      const clientOptions = this.buildClientOptions(profile);
      clientOptions.socketOptions = {
        ...clientOptions.socketOptions,
        connectTimeout: timeoutMs,
      };

      // Create temporary client
      testClient = new cassandra.Client(clientOptions);

      // Attempt connection
      await testClient.connect();

      // Execute test query to verify connectivity
      const query = 'SELECT release_version, cluster_name FROM system.local';
      const result = await testClient.execute(query);

      const row = result.first();
      const metadata: ConnectionMetadata = {
        cassandraVersion: row?.['release_version']?.toString(),
        clusterName: row?.['cluster_name']?.toString(),
        connectedDatacenter: profile.localDatacenter,
      };

      const connectionTimeMs = Date.now() - startTime;

      // Close test connection
      await testClient.shutdown();

      return {
        success: true,
        metadata,
        connectionTimeMs,
      };
    } catch (error) {
      // Ensure test client is closed
      if (testClient) {
        try {
          await testClient.shutdown();
        } catch {
          // Ignore shutdown errors
        }
      }

      const errorInfo = this.categorizeError(error);

      return {
        success: false,
        errorMessage: errorInfo.message,
        errorType: errorInfo.type,
        connectionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Executes a CQL query on the active connection.
   *
   * @param query - CQL query string
   * @param params - Optional query parameters (prepared statement values)
   * @param options - Optional execution options (consistency level, etc.)
   * @returns Query result set
   * @throws Error if not connected or query fails
   */
  async execute(
    query: string,
    params?: any[],
    options?: cassandra.QueryOptions
  ): Promise<cassandra.types.ResultSet> {
    if (!this.client) {
      throw new Error(
        'Not connected to Cassandra. Please connect to a cluster first.'
      );
    }

    try {
      const result = await this.client.execute(query, params, options);
      return result;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Closes the active Cassandra connection and cleans up resources.
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.shutdown();
      } catch (error) {
        // Log error but don't throw - we're disconnecting anyway
        console.error('Error during Cassandra client shutdown:', error);
      } finally {
        this.client = null;
        this.currentProfile = null;
      }
    }
  }

  /**
   * Checks if currently connected to a cluster.
   */
  isConnected(): boolean {
    return this.client !== null;
  }

  /**
   * Gets the profile of the current connection.
   */
  getCurrentProfile(): ConnectionProfile | null {
    return this.currentProfile;
  }

  /**
   * Retrieves metadata about the connected cluster.
   *
   * @private
   */
  private async getConnectionMetadata(): Promise<ConnectionMetadata> {
    if (!this.client) {
      throw new Error('Cannot get metadata: not connected');
    }

    try {
      // Query system.local for cluster info
      const query =
        'SELECT cluster_name, release_version, data_center FROM system.local';
      const result = await this.client.execute(query);
      const row = result.first();

      // Get node count from cluster metadata
      const hosts = this.client.getState().getConnectedHosts();

      return {
        clusterName: row?.['cluster_name']?.toString(),
        cassandraVersion: row?.['release_version']?.toString(),
        connectedDatacenter: row?.['data_center']?.toString(),
        nodeCount: hosts.length,
      };
    } catch (error) {
      console.warn('Failed to retrieve connection metadata:', error);
      return {};
    }
  }

  /**
   * Builds cassandra-driver ClientOptions from a ConnectionProfile.
   *
   * @private
   * @param profile - Connection profile
   * @returns Configured ClientOptions object
   */
  private buildClientOptions(profile: ConnectionProfile): cassandra.DseClientOptions {
    const options: cassandra.DseClientOptions = {
      contactPoints: profile.contactPoints,
      localDataCenter: profile.localDatacenter,
      keyspace: profile.keyspace,
    };

    // Configure authentication
    if (profile.auth.enabled && profile.auth.username && profile.auth.password) {
      options.credentials = {
        username: profile.auth.username,
        password: profile.auth.password,
      };
    }

    // Configure SSL
    if (profile.ssl.enabled) {
      const sslOptions: any = {
        rejectUnauthorized: profile.ssl.rejectUnauthorized ?? true,
      };

      // Load CA certificate if provided
      if (profile.ssl.caCertPath) {
        try {
          sslOptions.ca = [fs.readFileSync(profile.ssl.caCertPath, 'utf8')];
        } catch (error) {
          throw new Error(
            `Failed to load CA certificate from ${profile.ssl.caCertPath}: ${error}`
          );
        }
      }

      // Load client certificate if provided (mutual TLS)
      if (profile.ssl.clientCertPath) {
        try {
          sslOptions.cert = fs.readFileSync(profile.ssl.clientCertPath, 'utf8');
        } catch (error) {
          throw new Error(
            `Failed to load client certificate from ${profile.ssl.clientCertPath}: ${error}`
          );
        }
      }

      // Load client key if provided (mutual TLS)
      if (profile.ssl.clientKeyPath) {
        try {
          sslOptions.key = fs.readFileSync(profile.ssl.clientKeyPath, 'utf8');
        } catch (error) {
          throw new Error(
            `Failed to load client key from ${profile.ssl.clientKeyPath}: ${error}`
          );
        }
      }

      options.sslOptions = sslOptions;
    }

    // Configure socket options
    if (profile.socket) {
      options.socketOptions = {
        connectTimeout: profile.socket.connectTimeout ?? 30000,
        readTimeout: profile.socket.readTimeout ?? 120000,
        keepAlive: profile.socket.keepAlive ? true : false,
      };
    }

    // Set port if not default
    if (profile.port && profile.port !== 9042) {
      options.protocolOptions = {
        port: profile.port,
      };
    }

    return options;
  }

  /**
   * Categorizes a driver error and provides user-friendly message.
   *
   * @private
   * @param error - Error from cassandra-driver
   * @returns Categorized error with type and message
   */
  private categorizeError(error: any): {
    type: CassandraErrorType;
    message: string;
  } {
    const errorName = error?.constructor?.name || '';
    const errorMessage = error?.message || 'Unknown error';

    // NoHostAvailableError - can't reach any nodes
    if (errorName === 'NoHostAvailableError') {
      return {
        type: CassandraErrorType.NoHostAvailable,
        message:
          'Cannot reach any Cassandra nodes. Check that:\n' +
          '• Contact points are correct\n' +
          '• Cassandra is running\n' +
          '• Firewall allows connections on port 9042\n' +
          '• Network connectivity is available',
      };
    }

    // AuthenticationError - invalid credentials
    if (
      errorName === 'AuthenticationError' ||
      errorMessage.includes('authentication')
    ) {
      return {
        type: CassandraErrorType.AuthenticationError,
        message:
          'Authentication failed. Please verify:\n' +
          '• Username is correct\n' +
          '• Password is correct\n' +
          '• User has permission to connect',
      };
    }

    // OperationTimedOutError - query or connection timeout
    if (
      errorName === 'OperationTimedOutError' ||
      errorMessage.includes('timed out')
    ) {
      return {
        type: CassandraErrorType.OperationTimedOut,
        message:
          'Connection or query timed out. Possible causes:\n' +
          '• Cassandra cluster is overloaded\n' +
          '• Network latency is too high\n' +
          '• Query is too complex or scanning too much data\n' +
          '• Consider increasing timeout settings',
      };
    }

    // SyntaxError - invalid CQL
    if (errorName === 'SyntaxError' || errorMessage.includes('syntax')) {
      return {
        type: CassandraErrorType.SyntaxError,
        message: `Invalid CQL syntax: ${errorMessage}`,
      };
    }

    // InvalidRequest - keyspace/table doesn't exist, etc.
    if (
      errorName === 'ResponseError' &&
      (errorMessage.includes('unconfigured table') ||
        errorMessage.includes('does not exist'))
    ) {
      return {
        type: CassandraErrorType.InvalidRequest,
        message: `Invalid request: ${errorMessage}`,
      };
    }

    // BusyConnectionError - too many concurrent requests
    if (errorName === 'BusyConnectionError') {
      return {
        type: CassandraErrorType.BusyConnection,
        message:
          'All connections are busy. Too many concurrent requests.\n' +
          'Try reducing query load or increasing connection pool size.',
      };
    }

    // SSL/TLS errors
    if (
      errorMessage.includes('ssl') ||
      errorMessage.includes('tls') ||
      errorMessage.includes('certificate')
    ) {
      return {
        type: CassandraErrorType.SslError,
        message:
          'SSL/TLS connection failed. Please verify:\n' +
          '• Certificate paths are correct\n' +
          '• Certificates are valid and not expired\n' +
          '• Server expects SSL connections\n' +
          `Details: ${errorMessage}`,
      };
    }

    // Generic error
    return {
      type: CassandraErrorType.Unknown,
      message: `Cassandra error: ${errorMessage}`,
    };
  }

  /**
   * Handles errors by categorizing and throwing with user-friendly message.
   *
   * @private
   * @param error - Error from cassandra-driver
   * @throws Error with user-friendly message
   */
  private handleError(error: any): Error {
    const { message } = this.categorizeError(error);
    return new Error(message);
  }
}
