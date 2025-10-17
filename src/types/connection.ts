/**
 * Connection Profile Type Definitions
 *
 * These interfaces define the structure for storing and managing
 * Apache Cassandra connection configurations in CassandraLens.
 */

/**
 * Authentication configuration for Cassandra connection.
 * Supports username/password authentication via PlainTextAuthProvider.
 */
export interface AuthConfig {
  /**
   * Enable authentication for this connection.
   * When false, connection will be attempted without credentials.
   */
  enabled: boolean;

  /**
   * Cassandra username (typically a role name).
   * Required when authentication is enabled.
   */
  username?: string;

  /**
   * Cassandra password.
   *
   * **Security Note:** This field is only used during connection creation.
   * Passwords are stored separately in VS Code's encrypted Secret Storage API
   * and are never persisted in workspace settings.
   */
  password?: string;
}

/**
 * SSL/TLS configuration for encrypted connections.
 * Enables secure communication with Cassandra clusters.
 */
export interface SslConfig {
  /**
   * Enable SSL/TLS encryption for this connection.
   */
  enabled: boolean;

  /**
   * Path to Certificate Authority (CA) certificate file.
   * Used to verify the server's certificate.
   *
   * Example: '/path/to/ca-cert.pem'
   */
  caCertPath?: string;

  /**
   * Path to client certificate file (for mutual TLS).
   * Required only if the server requires client certificate authentication.
   *
   * Example: '/path/to/client-cert.pem'
   */
  clientCertPath?: string;

  /**
   * Path to client private key file (for mutual TLS).
   * Must correspond to the clientCertPath.
   *
   * Example: '/path/to/client-key.pem'
   */
  clientKeyPath?: string;

  /**
   * Whether to reject connections if the server certificate cannot be verified.
   *
   * - true (recommended): Enforce certificate validation for security
   * - false: Allow connections even with invalid certificates (use only for testing)
   *
   * @default true
   */
  rejectUnauthorized?: boolean;
}

/**
 * Socket and timeout configuration for network connections.
 * Controls how the driver handles network communication with Cassandra nodes.
 */
export interface SocketConfig {
  /**
   * Connection timeout in milliseconds.
   * Maximum time to wait when establishing a connection to a node.
   *
   * @default 30000 (30 seconds)
   */
  connectTimeout?: number;

  /**
   * Read timeout in milliseconds.
   * Maximum time to wait for a response to a query.
   *
   * @default 120000 (2 minutes)
   */
  readTimeout?: number;

  /**
   * Keep-alive interval in milliseconds.
   * How often to send TCP keep-alive packets to maintain idle connections.
   * Set to 0 to disable keep-alive.
   *
   * @default 0 (disabled)
   */
  keepAlive?: number;
}

/**
 * Complete connection profile for a Cassandra cluster.
 *
 * This interface represents all information needed to establish and manage
 * a connection to an Apache Cassandra cluster. It includes both user-facing
 * metadata (name, description) and technical connection parameters.
 *
 * **Storage Strategy:**
 * - Non-sensitive fields: Stored in VS Code workspace settings
 * - Passwords: Stored in VS Code Secret Storage API (encrypted)
 */
export interface ConnectionProfile {
  /**
   * Unique identifier for this connection profile.
   * Auto-generated using UUID v4 when profile is created.
   */
  id: string;

  /**
   * User-friendly name for this connection.
   * Displayed in UI elements like status bar and connection picker.
   *
   * Example: 'Production Cluster', 'Local Development', 'Staging'
   */
  name: string;

  /**
   * Optional description providing additional context about this connection.
   * Useful for team environments or managing multiple similar clusters.
   *
   * Example: 'Production cluster in AWS us-east-1'
   */
  description?: string;

  /**
   * Array of Cassandra node addresses (contact points).
   * Can be IP addresses or hostnames. The driver will use these to discover
   * the cluster topology.
   *
   * **Best Practice:** Provide 2-3 nodes from different racks for redundancy.
   *
   * Example: ['10.0.1.10', '10.0.1.11', 'cassandra.example.com']
   */
  contactPoints: string[];

  /**
   * Port number for Cassandra native protocol connections.
   *
   * @default 9042 (standard Cassandra port)
   */
  port: number;

  /**
   * Local datacenter name for the driver to connect to.
   * Required for the driver's load balancing policy.
   *
   * **Important:** Must match an actual datacenter name in your cluster.
   * Use 'datacenter1' for single-datacenter clusters or default ccm setups.
   *
   * Example: 'us-east-1', 'datacenter1', 'dc1'
   */
  localDatacenter: string;

  /**
   * Default keyspace to USE when connection is established.
   * Optional - you can switch keyspaces after connecting.
   *
   * Example: 'system', 'my_application', 'analytics'
   */
  keyspace?: string;

  /**
   * Authentication configuration.
   * Leave enabled: false for clusters without authentication.
   */
  auth: AuthConfig;

  /**
   * SSL/TLS encryption configuration.
   * Leave enabled: false for unencrypted connections (local development).
   */
  ssl: SslConfig;

  /**
   * Socket and timeout configuration.
   * Uses driver defaults if not specified.
   */
  socket: SocketConfig;

  /**
   * Timestamp when this profile was created.
   */
  createdAt: Date;

  /**
   * Timestamp when this profile was last modified.
   */
  lastModifiedAt?: Date;

  /**
   * Timestamp of the last successful connection using this profile.
   * Used to sort "recently used" connections in UI.
   */
  lastConnectedAt?: Date;
}

/**
 * Minimal subset of ConnectionProfile for storage in workspace settings.
 * Excludes sensitive fields like passwords which are stored separately.
 */
export interface StoredConnectionProfile extends Omit<ConnectionProfile, 'auth'> {
  /**
   * Authentication config without the password field.
   */
  auth: Omit<AuthConfig, 'password'> & {
    /**
     * Flag indicating whether a password is stored in Secret Storage.
     * Used to determine if we need to retrieve the password on load.
     */
    hasPassword: boolean;
  };
}
