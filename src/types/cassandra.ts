/**
 * Cassandra-Specific Type Definitions
 *
 * Types and enums related to Cassandra database operations,
 * connection states, and query execution.
 */

/**
 * Connection lifecycle states.
 * Used to track and display the current status of a Cassandra connection.
 */
export enum ConnectionStatus {
  /**
   * No active connection. Initial state or after disconnection.
   */
  Disconnected = 'disconnected',

  /**
   * Connection attempt in progress.
   * Driver is establishing connections to cluster nodes.
   */
  Connecting = 'connecting',

  /**
   * Successfully connected to the cluster.
   * Ready to execute queries.
   */
  Connected = 'connected',

  /**
   * Connection failed or was lost.
   * Check error message for details.
   */
  Error = 'error',

  /**
   * Connection is being gracefully closed.
   * Waiting for pending operations to complete.
   */
  Disconnecting = 'disconnecting'
}

/**
 * Cassandra consistency levels for read and write operations.
 * These are standard CQL consistency levels that determine how many replicas
 * must acknowledge a request before considering it successful.
 *
 * @see https://cassandra.apache.org/doc/latest/cassandra/architecture/dynamo.html#tunable-consistency
 */
export enum ConsistencyLevel {
  /**
   * Ensures that data is written to at least one replica (write only).
   * Fastest but least durable.
   */
  ANY = 'ANY',

  /**
   * At least one replica must respond.
   * Fastest read/write with lowest consistency guarantee.
   */
  ONE = 'ONE',

  /**
   * At least two replicas must respond.
   */
  TWO = 'TWO',

  /**
   * At least three replicas must respond.
   */
  THREE = 'THREE',

  /**
   * A quorum of replicas (n/2 + 1) across all datacenters must respond.
   * **Recommended default** for balanced consistency and performance.
   */
  QUORUM = 'QUORUM',

  /**
   * All replicas must respond.
   * Highest consistency but slowest and least available.
   */
  ALL = 'ALL',

  /**
   * A quorum of replicas in the local datacenter must respond.
   * **Best for multi-DC clusters** - fast and consistent within DC.
   */
  LOCAL_QUORUM = 'LOCAL_QUORUM',

  /**
   * A quorum of replicas in each datacenter must respond.
   * Strong consistency across all datacenters.
   */
  EACH_QUORUM = 'EACH_QUORUM',

  /**
   * At least one replica in the local datacenter must respond.
   * Prevents cross-DC latency for reads.
   */
  LOCAL_ONE = 'LOCAL_ONE',

  /**
   * Ensures the serial portion of a lightweight transaction has completed.
   * Used for SERIAL/CONDITIONAL operations (IF NOT EXISTS, IF EXISTS).
   */
  SERIAL = 'SERIAL',

  /**
   * Like SERIAL but only requires nodes in the local datacenter.
   */
  LOCAL_SERIAL = 'LOCAL_SERIAL'
}

/**
 * Common Cassandra error types.
 * Used for categorizing and handling driver errors with user-friendly messages.
 */
export enum CassandraErrorType {
  /**
   * Cannot reach any Cassandra node.
   * All contact points are unreachable.
   */
  NoHostAvailable = 'NoHostAvailable',

  /**
   * Authentication failed - invalid username or password.
   */
  AuthenticationError = 'AuthenticationError',

  /**
   * Query execution timed out.
   * May indicate slow query or overloaded cluster.
   */
  OperationTimedOut = 'OperationTimedOut',

  /**
   * Invalid CQL syntax in query.
   */
  SyntaxError = 'SyntaxError',

  /**
   * Keyspace or table does not exist.
   */
  InvalidRequest = 'InvalidRequest',

  /**
   * Connection was dropped during operation.
   */
  ConnectionError = 'ConnectionError',

  /**
   * All connections to a host are at max capacity.
   * Too many concurrent requests.
   */
  BusyConnection = 'BusyConnection',

  /**
   * SSL/TLS handshake failed.
   * Certificate validation or configuration issue.
   */
  SslError = 'SslError',

  /**
   * Generic or unknown error.
   */
  Unknown = 'Unknown'
}

/**
 * Metadata about an active Cassandra connection.
 * Information retrieved from the cluster after successful connection.
 */
export interface ConnectionMetadata {
  /**
   * Cluster name from system.local.
   */
  clusterName?: string;

  /**
   * Cassandra server version (e.g., '4.0.7', '3.11.14').
   */
  cassandraVersion?: string;

  /**
   * Name of the datacenter we're connected to.
   */
  connectedDatacenter?: string;

  /**
   * Number of nodes visible in the cluster topology.
   */
  nodeCount?: number;

  /**
   * List of keyspaces in the cluster (cached after first retrieval).
   */
  keyspaces?: string[];
}

/**
 * Result of a connection test operation.
 * Returned by CassandraClient.testConnection().
 */
export interface ConnectionTestResult {
  /**
   * Whether the connection test succeeded.
   */
  success: boolean;

  /**
   * Error message if connection failed.
   * User-friendly description of what went wrong.
   */
  errorMessage?: string;

  /**
   * Specific error type for programmatic handling.
   */
  errorType?: CassandraErrorType;

  /**
   * Metadata retrieved during successful connection test.
   */
  metadata?: ConnectionMetadata;

  /**
   * Time taken to establish connection (milliseconds).
   */
  connectionTimeMs?: number;
}
