/**
 * Input Validation Utilities
 *
 * Provides validation functions for connection form inputs and settings.
 * All validators return `undefined` for valid input, or an error message for invalid input.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Validates a connection name.
 *
 * **Rules:**
 * - Must not be empty
 * - Must not contain only whitespace
 * - Should be reasonable length (1-100 characters)
 *
 * @param name - Connection name to validate
 * @returns Error message if invalid, undefined if valid
 */
export function validateConnectionName(name: string): string | undefined {
  if (!name || name.trim().length === 0) {
    return 'Connection name is required';
  }

  if (name.length > 100) {
    return 'Connection name must be 100 characters or less';
  }

  return undefined;
}

/**
 * Validates contact points (Cassandra node addresses).
 *
 * **Format:** Comma-separated list of IP addresses or hostnames
 * **Examples:**
 * - Valid: "10.0.1.10", "10.0.1.10,10.0.1.11", "cassandra.example.com"
 * - Invalid: "", "not a valid hostname!", "10.0.1"
 *
 * @param input - Comma-separated contact points
 * @returns Error message if invalid, undefined if valid
 */
export function validateContactPoints(input: string): string | undefined {
  if (!input || input.trim().length === 0) {
    return 'At least one contact point is required';
  }

  const contactPoints = input.split(',').map((cp) => cp.trim());

  for (const contactPoint of contactPoints) {
    if (contactPoint.length === 0) {
      return 'Contact points cannot be empty';
    }

    // Check if it's a valid IP address or hostname
    // IP address pattern (simplified, allows basic IPv4)
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    // Hostname pattern (simplified, allows letters, numbers, hyphens, dots)
    const hostnamePattern = /^[a-zA-Z0-9][a-zA-Z0-9\-\.]*[a-zA-Z0-9]$/;

    if (!ipPattern.test(contactPoint) && !hostnamePattern.test(contactPoint)) {
      return `Invalid contact point: ${contactPoint}. Must be an IP address or hostname.`;
    }

    // Validate IP address ranges if it's an IP
    if (ipPattern.test(contactPoint)) {
      const octets = contactPoint.split('.').map((octet) => parseInt(octet, 10));
      if (octets.some((octet) => octet < 0 || octet > 255)) {
        return `Invalid IP address: ${contactPoint}. Octets must be 0-255.`;
      }
    }
  }

  return undefined;
}

/**
 * Validates a port number.
 *
 * **Rules:**
 * - Must be a valid integer
 * - Must be in range 1-65535
 *
 * @param input - Port number as string
 * @returns Error message if invalid, undefined if valid
 */
export function validatePort(input: string): string | undefined {
  if (!input || input.trim().length === 0) {
    return 'Port number is required';
  }

  const port = parseInt(input, 10);

  if (isNaN(port)) {
    return 'Port must be a number';
  }

  if (port < 1 || port > 65535) {
    return 'Port must be between 1 and 65535';
  }

  return undefined;
}

/**
 * Validates a datacenter name.
 *
 * **Rules:**
 * - Must not be empty
 * - Should be a valid CQL identifier (alphanumeric with underscores)
 *
 * @param input - Datacenter name
 * @returns Error message if invalid, undefined if valid
 */
export function validateDatacenter(input: string): string | undefined {
  if (!input || input.trim().length === 0) {
    return 'Datacenter name is required';
  }

  // Datacenter names are typically simple identifiers
  // Allow letters, numbers, underscores, hyphens
  const datacenterPattern = /^[a-zA-Z0-9_\-]+$/;

  if (!datacenterPattern.test(input)) {
    return 'Datacenter name can only contain letters, numbers, underscores, and hyphens';
  }

  if (input.length > 100) {
    return 'Datacenter name must be 100 characters or less';
  }

  return undefined;
}

/**
 * Validates a keyspace name (CQL identifier).
 *
 * **Rules:**
 * - Must be a valid CQL identifier
 * - Can contain letters, numbers, underscores
 * - Must start with a letter or underscore
 * - Case-insensitive unless quoted
 *
 * @param input - Keyspace name
 * @returns Error message if invalid, undefined if valid
 */
export function validateKeyspaceName(input: string): string | undefined {
  if (!input || input.trim().length === 0) {
    return undefined; // Keyspace is optional
  }

  // CQL identifier pattern
  // Must start with letter or underscore, then letters, numbers, underscores
  const identifierPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

  if (!identifierPattern.test(input)) {
    return 'Keyspace name must start with a letter or underscore, and contain only letters, numbers, and underscores';
  }

  if (input.length > 48) {
    return 'Keyspace name must be 48 characters or less';
  }

  // Check if it's a reserved keyword
  const reservedKeywords = [
    'add',
    'all',
    'allow',
    'alter',
    'and',
    'apply',
    'as',
    'asc',
    'authorize',
    'batch',
    'begin',
    'by',
    'columnfamily',
    'create',
    'delete',
    'desc',
    'describe',
    'drop',
    'entries',
    'execute',
    'from',
    'full',
    'grant',
    'if',
    'in',
    'index',
    'infinity',
    'insert',
    'into',
    'is',
    'keyspace',
    'limit',
    'modify',
    'nan',
    'norecursive',
    'not',
    'null',
    'of',
    'on',
    'or',
    'order',
    'primary',
    'rename',
    'replace',
    'revoke',
    'schema',
    'select',
    'set',
    'table',
    'to',
    'token',
    'truncate',
    'unlogged',
    'update',
    'use',
    'using',
    'where',
    'with',
  ];

  if (reservedKeywords.includes(input.toLowerCase())) {
    return `"${input}" is a reserved keyword. Use quotes or choose a different name.`;
  }

  return undefined;
}

/**
 * Validates a username.
 *
 * @param input - Username
 * @returns Error message if invalid, undefined if valid
 */
export function validateUsername(input: string): string | undefined {
  if (!input || input.trim().length === 0) {
    return 'Username is required when authentication is enabled';
  }

  if (input.length > 100) {
    return 'Username must be 100 characters or less';
  }

  return undefined;
}

/**
 * Validates a password.
 *
 * @param input - Password
 * @returns Error message if invalid, undefined if valid
 */
export function validatePassword(input: string): string | undefined {
  if (!input || input.length === 0) {
    return 'Password is required when authentication is enabled';
  }

  // Note: We don't enforce password complexity since Cassandra
  // doesn't have password requirements - that's up to the admin
  return undefined;
}

/**
 * Validates a file path.
 *
 * **Rules:**
 * - Path must exist (for SSL certificates, etc.)
 * - Must be a file, not a directory
 *
 * @param input - File path
 * @param fileDescription - Description of the file (e.g., "CA certificate")
 * @returns Error message if invalid, undefined if valid
 */
export function validateFilePath(
  input: string,
  fileDescription: string = 'File'
): string | undefined {
  if (!input || input.trim().length === 0) {
    return `${fileDescription} path is required`;
  }

  try {
    const resolvedPath = path.resolve(input);

    if (!fs.existsSync(resolvedPath)) {
      return `${fileDescription} not found: ${resolvedPath}`;
    }

    const stats = fs.statSync(resolvedPath);
    if (!stats.isFile()) {
      return `${fileDescription} path must be a file, not a directory`;
    }

    return undefined;
  } catch (error) {
    return `Invalid file path: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Validates an optional file path (empty is allowed).
 *
 * @param input - File path
 * @param fileDescription - Description of the file
 * @returns Error message if invalid, undefined if valid
 */
export function validateOptionalFilePath(
  input: string,
  fileDescription: string = 'File'
): string | undefined {
  if (!input || input.trim().length === 0) {
    return undefined; // Empty is valid for optional
  }

  return validateFilePath(input, fileDescription);
}

/**
 * Validates a timeout value in milliseconds.
 *
 * @param input - Timeout in milliseconds as string
 * @param min - Minimum allowed timeout (default: 1000ms)
 * @param max - Maximum allowed timeout (default: 300000ms = 5 minutes)
 * @returns Error message if invalid, undefined if valid
 */
export function validateTimeout(
  input: string,
  min: number = 1000,
  max: number = 300000
): string | undefined {
  if (!input || input.trim().length === 0) {
    return undefined; // Optional
  }

  const timeout = parseInt(input, 10);

  if (isNaN(timeout)) {
    return 'Timeout must be a number';
  }

  if (timeout < min) {
    return `Timeout must be at least ${min}ms`;
  }

  if (timeout > max) {
    return `Timeout must be at most ${max}ms`;
  }

  return undefined;
}
