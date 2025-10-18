/**
 * Connection Manager Service
 *
 * Manages the active Cassandra connection state and coordinates
 * between the CassandraClient, storage, and UI components.
 *
 * This is the single source of truth for "which connection is currently active"
 * and provides connection metadata to other parts of the extension.
 */

import { EventEmitter } from 'events';
import { CassandraClient } from './cassandraClient';
import { ConnectionProfile } from '../types/connection';
import { ConnectionStatus, ConnectionMetadata } from '../types/cassandra';

/**
 * Events emitted by ConnectionManager.
 */
export interface ConnectionManagerEvents {
  /**
   * Emitted when connection status changes.
   * @param status - New connection status
   * @param profile - Associated connection profile (if applicable)
   */
  statusChanged: (status: ConnectionStatus, profile?: ConnectionProfile) => void;

  /**
   * Emitted when connection is successfully established.
   * @param profile - Connected profile
   * @param metadata - Cluster metadata
   */
  connected: (profile: ConnectionProfile, metadata: ConnectionMetadata) => void;

  /**
   * Emitted when connection is closed.
   */
  disconnected: () => void;

  /**
   * Emitted when connection attempt fails.
   * @param profile - Failed profile
   * @param error - Error message
   */
  connectionError: (profile: ConnectionProfile, error: string) => void;
}

/**
 * Manages active Cassandra connection state.
 *
 * **Responsibilities:**
 * - Maintains single active connection at a time
 * - Coordinates between CassandraClient and UI components
 * - Emits events for connection state changes
 * - Provides connection metadata for display
 * - Handles connection switching (disconnect old → connect new)
 *
 * **Usage:**
 * ```typescript
 * const manager = new ConnectionManager(cassandraClient);
 *
 * manager.on('connected', (profile, metadata) => {
 *   console.log(`Connected to ${metadata.clusterName}`);
 * });
 *
 * await manager.setActiveConnection(profile);
 * const client = manager.getActiveClient();
 * ```
 */
export class ConnectionManager extends EventEmitter {
  /**
   * Current connection status.
   */
  private status: ConnectionStatus = ConnectionStatus.Disconnected;

  /**
   * Currently active connection profile.
   */
  private activeProfile: ConnectionProfile | null = null;

  /**
   * Metadata about the connected cluster.
   */
  private metadata: ConnectionMetadata | null = null;

  /**
   * Cassandra client instance.
   */
  private client: CassandraClient;

  /**
   * Creates a new ConnectionManager.
   *
   * @param client - CassandraClient instance to manage
   */
  constructor(client: CassandraClient) {
    super();
    this.client = client;
  }

  /**
   * Sets the active connection by connecting to a cluster.
   *
   * If another connection is active, it will be disconnected first.
   *
   * @param profile - Connection profile to activate
   * @returns Metadata about the connected cluster
   * @throws Error if connection fails
   */
  async setActiveConnection(profile: ConnectionProfile): Promise<ConnectionMetadata> {
    try {
      // Disconnect existing connection if present
      if (this.status !== ConnectionStatus.Disconnected) {
        await this.disconnect();
      }

      // Update status to connecting
      this.status = ConnectionStatus.Connecting;
      this.activeProfile = profile;
      this.emit('statusChanged', this.status, profile);

      // Attempt connection
      const metadata = await this.client.connect(profile);

      // Connection successful
      this.status = ConnectionStatus.Connected;
      this.metadata = metadata;
      this.emit('statusChanged', this.status, profile);
      this.emit('connected', profile, metadata);

      return metadata;
    } catch (error) {
      // Connection failed
      this.status = ConnectionStatus.Error;
      this.activeProfile = null;
      this.metadata = null;
      this.emit('statusChanged', this.status, profile);
      this.emit('connectionError', profile, error instanceof Error ? error.message : 'Unknown error');

      throw error;
    }
  }

  /**
   * Disconnects the active connection.
   */
  async disconnect(): Promise<void> {
    if (this.status === ConnectionStatus.Disconnected) {
      return; // Already disconnected
    }

    try {
      this.status = ConnectionStatus.Disconnecting;
      this.emit('statusChanged', this.status);

      await this.client.disconnect();

      this.status = ConnectionStatus.Disconnected;
      this.activeProfile = null;
      this.metadata = null;
      this.emit('statusChanged', this.status);
      this.emit('disconnected');
    } catch (error) {
      // Force disconnected state even if shutdown fails
      this.status = ConnectionStatus.Disconnected;
      this.activeProfile = null;
      this.metadata = null;
      this.emit('statusChanged', this.status);
      throw error;
    }
  }

  /**
   * Gets the active CassandraClient instance.
   *
   * @returns Active client, or null if not connected
   */
  getActiveClient(): CassandraClient | null {
    if (this.status === ConnectionStatus.Connected) {
      return this.client;
    }
    return null;
  }

  /**
   * Gets the currently active connection profile.
   *
   * @returns Active profile, or null if not connected
   */
  getActiveProfile(): ConnectionProfile | null {
    return this.activeProfile;
  }

  /**
   * Gets the current connection status.
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Gets metadata about the connected cluster.
   *
   * @returns Cluster metadata, or null if not connected
   */
  getMetadata(): ConnectionMetadata | null {
    return this.metadata;
  }

  /**
   * Checks if currently connected.
   */
  isConnected(): boolean {
    return this.status === ConnectionStatus.Connected;
  }

  /**
   * Gets the name of the currently active connection.
   *
   * @returns Connection name, or null if not connected
   */
  getActiveConnectionName(): string | null {
    return this.activeProfile?.name || null;
  }

  /**
   * Switches to a different connection.
   *
   * Convenience method that disconnects current connection
   * and connects to a new profile.
   *
   * @param profile - New connection profile
   * @returns Metadata about the new connection
   */
  async switchConnection(profile: ConnectionProfile): Promise<ConnectionMetadata> {
    return await this.setActiveConnection(profile);
  }

  /**
   * Type-safe event listener registration.
   *
   * @override
   */
  on<K extends keyof ConnectionManagerEvents>(
    event: K,
    listener: ConnectionManagerEvents[K]
  ): this {
    return super.on(event, listener);
  }

  /**
   * Type-safe event emitter.
   *
   * @override
   */
  emit<K extends keyof ConnectionManagerEvents>(
    event: K,
    ...args: Parameters<ConnectionManagerEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }

  /**
   * Type-safe one-time event listener.
   *
   * @override
   */
  once<K extends keyof ConnectionManagerEvents>(
    event: K,
    listener: ConnectionManagerEvents[K]
  ): this {
    return super.once(event, listener);
  }

  /**
   * Type-safe event listener removal.
   *
   * @override
   */
  off<K extends keyof ConnectionManagerEvents>(
    event: K,
    listener: ConnectionManagerEvents[K]
  ): this {
    return super.off(event, listener);
  }
}
