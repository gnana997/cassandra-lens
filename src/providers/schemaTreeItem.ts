/**
 * Base class for Cassandra schema tree items (keyspace, table, column).
 *
 * Provides common functionality and type identification for schema nodes
 * in the tree view hierarchy.
 */

import * as vscode from 'vscode';

/**
 * Enum to distinguish between different schema node types.
 * Used for type checking in getChildren() logic.
 */
export enum SchemaNodeType {
  Keyspace = 'keyspace',
  Table = 'table',
  Column = 'column',
}

/**
 * Abstract base class for all schema-related tree items.
 *
 * This class extends VS Code's TreeItem and adds schema-specific
 * properties that all schema nodes (keyspace, table, column) share.
 */
export abstract class SchemaTreeItem extends vscode.TreeItem {
  /**
   * Type of schema node (keyspace, table, or column).
   * Used by ConnectionTreeProvider to determine how to load children.
   */
  public abstract readonly nodeType: SchemaNodeType;

  /**
   * Keyspace name this item belongs to.
   * All schema items exist within a keyspace context.
   */
  public abstract readonly keyspace: string;

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    contextValue?: string
  ) {
    super(label, collapsibleState);
    if (contextValue) {
      this.contextValue = contextValue;
    }
  }
}
