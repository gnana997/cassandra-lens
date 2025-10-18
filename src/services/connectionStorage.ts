/**
 * Connection Storage Service
 *
 * Manages persistent storage of Cassandra connection profiles using VS Code APIs.
 * Implements a secure split-storage strategy:
 * - Non-sensitive data → Workspace settings (visible in settings.json)
 * - Passwords → Secret Storage API (encrypted, platform-native)
 */

import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { ConnectionProfile, StoredConnectionProfile } from '../types/connection';

/**
 * Service class for persisting and retrieving connection profiles.
 *
 * **Security Architecture:**
 * - Public connection details are stored in workspace settings under 'cassandraLens.connections'
 * - Passwords are stored separately in VS Code's Secret Storage (encrypted by OS)
 * - Each password is keyed by: `cassandra-lens.password.${profileId}`
 *
 * **Storage Persistence:**
 * - Workspace settings: Survives VS Code restarts, stored in .vscode/settings.json
 * - Secret Storage: Survives VS Code restarts, stored in OS-specific secure storage
 */
export class ConnectionStorage {
  /**
   * Configuration key for storing connection profiles in workspace settings.
   */
  private static readonly CONNECTIONS_CONFIG_KEY = 'cassandraLens.connections';

  /**
   * Prefix for password keys in Secret Storage.
   */
  private static readonly PASSWORD_SECRET_PREFIX = 'cassandra-lens.password';

  /**
   * VS Code extension context providing access to storage APIs.
   */
  private readonly context: vscode.ExtensionContext;

  /**
   * Creates a new ConnectionStorage instance.
   *
   * @param context - Extension context from the activate() function
   */
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Saves a connection profile to persistent storage.
   *
   * **Process:**
   * 1. Generate unique ID if not present
   * 2. Save password to Secret Storage (if authentication enabled)
   * 3. Save public profile data to workspace settings
   *
   * @param profile - Complete connection profile including password
   * @returns The saved profile with generated ID
   * @throws Error if save operation fails
   */
  async saveConnection(profile: ConnectionProfile): Promise<ConnectionProfile> {
    try {
      // Generate unique ID for new profiles
      if (!profile.id) {
        profile.id = uuidv4();
      }

      // Set timestamps
      if (!profile.createdAt) {
        profile.createdAt = new Date();
      }
      profile.lastModifiedAt = new Date();

      // Save password to Secret Storage if provided
      if (profile.auth.enabled && profile.auth.password) {
        const passwordKey = this.getPasswordKey(profile.id);
        await this.context.secrets.store(passwordKey, profile.auth.password);
      }

      // Create stored profile (without password)
      const storedProfile: StoredConnectionProfile = {
        ...profile,
        auth: {
          enabled: profile.auth.enabled,
          username: profile.auth.username,
          hasPassword: !!(profile.auth.enabled && profile.auth.password),
        },
      };

      // Get existing profiles
      const existingProfiles = await this.loadStoredProfiles();

      // Check for duplicate names (excluding self when updating)
      const duplicateName = existingProfiles.find(
        (p) => p.name === profile.name && p.id !== profile.id
      );
      if (duplicateName) {
        throw new Error(
          `A connection named "${profile.name}" already exists. Please choose a different name.`
        );
      }

      // Update or add profile
      const profileIndex = existingProfiles.findIndex((p) => p.id === profile.id);
      if (profileIndex >= 0) {
        existingProfiles[profileIndex] = storedProfile;
      } else {
        existingProfiles.push(storedProfile);
      }

      // Save to workspace settings
      await this.saveStoredProfiles(existingProfiles);

      return profile;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown error saving connection profile';
      throw new Error(`Failed to save connection profile: ${message}`);
    }
  }

  /**
   * Loads all connection profiles from storage.
   *
   * **Process:**
   * 1. Load public profiles from workspace settings
   * 2. Retrieve passwords from Secret Storage for authenticated profiles
   * 3. Merge password back into profile
   *
   * @returns Array of complete connection profiles
   */
  async loadConnections(): Promise<ConnectionProfile[]> {
    try {
      const storedProfiles = await this.loadStoredProfiles();
      const profiles: ConnectionProfile[] = [];

      for (const stored of storedProfiles) {
        // Reconstruct full profile
        const profile: ConnectionProfile = {
          ...stored,
          auth: {
            enabled: stored.auth.enabled,
            username: stored.auth.username,
            password: undefined, // Will be populated below if needed
          },
        };

        // Retrieve password from Secret Storage if it exists
        if (stored.auth.hasPassword) {
          const passwordKey = this.getPasswordKey(stored.id);
          const password = await this.context.secrets.get(passwordKey);
          if (password) {
            profile.auth.password = password;
          }
        }

        profiles.push(profile);
      }

      return profiles;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error loading profiles';
      vscode.window.showErrorMessage(
        `Failed to load connection profiles: ${message}`
      );
      return [];
    }
  }

  /**
   * Retrieves a single connection profile by ID.
   *
   * @param id - Unique profile identifier
   * @returns The connection profile, or undefined if not found
   */
  async getConnection(id: string): Promise<ConnectionProfile | undefined> {
    const profiles = await this.loadConnections();
    return profiles.find((p) => p.id === id);
  }

  /**
   * Finds a connection profile by its name.
   * Useful for @conn directives that reference connections by name.
   *
   * @param name - Connection name to search for
   * @returns The connection profile, or undefined if not found
   */
  async findConnectionByName(name: string): Promise<ConnectionProfile | undefined> {
    const profiles = await this.loadConnections();
    return profiles.find((p) => p.name === name);
  }

  /**
   * Updates an existing connection profile.
   *
   * @param profile - Updated profile (must have existing ID)
   * @throws Error if profile ID doesn't exist
   */
  async updateConnection(profile: ConnectionProfile): Promise<void> {
    if (!profile.id) {
      throw new Error('Cannot update connection: profile ID is required');
    }

    const existing = await this.getConnection(profile.id);
    if (!existing) {
      throw new Error(`Cannot update connection: profile with ID ${profile.id} not found`);
    }

    // Save will handle update logic
    await this.saveConnection(profile);
  }

  /**
   * Deletes a connection profile and its associated password.
   *
   * @param id - Unique profile identifier
   * @throws Error if delete operation fails
   */
  async deleteConnection(id: string): Promise<void> {
    try {
      // Load existing profiles
      const existingProfiles = await this.loadStoredProfiles();

      // Find profile to delete
      const profileIndex = existingProfiles.findIndex((p) => p.id === id);
      if (profileIndex === -1) {
        throw new Error(`Connection profile with ID ${id} not found`);
      }

      const profile = existingProfiles[profileIndex];

      // Delete password from Secret Storage if it exists
      if (profile.auth.hasPassword) {
        const passwordKey = this.getPasswordKey(id);
        await this.context.secrets.delete(passwordKey);
      }

      // Remove from array
      existingProfiles.splice(profileIndex, 1);

      // Save updated list
      await this.saveStoredProfiles(existingProfiles);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error deleting profile';
      throw new Error(`Failed to delete connection profile: ${message}`);
    }
  }

  /**
   * Checks if a connection name already exists.
   *
   * @param name - Connection name to check
   * @param excludeId - Optional ID to exclude from check (for updates)
   * @returns True if name is already in use
   */
  async connectionNameExists(name: string, excludeId?: string): Promise<boolean> {
    const profiles = await this.loadConnections();
    return profiles.some((p) => p.name === name && p.id !== excludeId);
  }

  /**
   * Loads raw stored profiles from workspace settings.
   *
   * @private
   * @returns Array of stored profiles (without passwords)
   */
  private async loadStoredProfiles(): Promise<StoredConnectionProfile[]> {
    const config = vscode.workspace.getConfiguration();
    const profiles = config.get<StoredConnectionProfile[]>(
      ConnectionStorage.CONNECTIONS_CONFIG_KEY,
      []
    );

    // Convert date strings back to Date objects
    return profiles.map((p) => ({
      ...p,
      createdAt: new Date(p.createdAt),
      lastModifiedAt: p.lastModifiedAt ? new Date(p.lastModifiedAt) : undefined,
      lastConnectedAt: p.lastConnectedAt ? new Date(p.lastConnectedAt) : undefined,
    }));
  }

  /**
   * Saves stored profiles to workspace settings.
   *
   * @private
   * @param profiles - Array of stored profiles to save
   */
  private async saveStoredProfiles(
    profiles: StoredConnectionProfile[]
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration();
    await config.update(
      ConnectionStorage.CONNECTIONS_CONFIG_KEY,
      profiles,
      vscode.ConfigurationTarget.Workspace
    );
  }

  /**
   * Generates the Secret Storage key for a profile's password.
   *
   * @private
   * @param profileId - Unique profile identifier
   * @returns Secret Storage key string
   */
  private getPasswordKey(profileId: string): string {
    return `${ConnectionStorage.PASSWORD_SECRET_PREFIX}.${profileId}`;
  }

  /**
   * Updates the lastConnectedAt timestamp for a profile.
   * Called by ConnectionManager after successful connection.
   *
   * @param id - Profile ID
   */
  async updateLastConnectedTimestamp(id: string): Promise<void> {
    const profile = await this.getConnection(id);
    if (profile) {
      profile.lastConnectedAt = new Date();
      await this.saveConnection(profile);
    }
  }
}
