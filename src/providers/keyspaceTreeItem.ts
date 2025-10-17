/**
 * Tree item representing a Cassandra keyspace in the schema tree.
 *
 * Keyspaces are expandable nodes that contain tables.
 */

import * as vscode from 'vscode';
import { SchemaTreeItem, SchemaNodeType } from './schemaTreeItem';

export class KeyspaceTreeItem extends SchemaTreeItem {
  public readonly nodeType = SchemaNodeType.Keyspace;
  public readonly keyspace: string;

  /**
   * Creates a tree item for a keyspace.
   *
   * @param keyspaceName - Name of the keyspace
   */
  constructor(keyspaceName: string) {
    super(keyspaceName, vscode.TreeItemCollapsibleState.Collapsed, 'keyspace');

    this.keyspace = keyspaceName;

    // Set icon - using folder icon for keyspaces
    this.iconPath = new vscode.ThemeIcon('symbol-namespace');

    // Set tooltip with keyspace information
    this.tooltip = this.buildTooltip();

    // No command on click - just expand/collapse
  }

  /**
   * Builds a detailed tooltip showing keyspace information.
   */
  private buildTooltip(): string {
    return `Keyspace: ${this.keyspace}\n\nClick to expand and view tables`;
  }
}
