/**
 * Tree item representing a Cassandra table in the schema tree.
 *
 * Tables are expandable nodes that contain columns.
 */

import * as vscode from 'vscode';
import { SchemaTreeItem, SchemaNodeType } from './schemaTreeItem';

export class TableTreeItem extends SchemaTreeItem {
  public readonly nodeType = SchemaNodeType.Table;
  public readonly keyspace: string;
  public readonly table: string;

  /**
   * Creates a tree item for a table.
   *
   * @param keyspaceName - Name of the keyspace this table belongs to
   * @param tableName - Name of the table
   */
  constructor(keyspaceName: string, tableName: string) {
    super(tableName, vscode.TreeItemCollapsibleState.Collapsed, 'table');

    this.keyspace = keyspaceName;
    this.table = tableName;

    // Set description (shows next to name in tree)
    this.description = `${keyspaceName}.${tableName}`;

    // Set icon - using table icon for tables
    this.iconPath = new vscode.ThemeIcon('symbol-class');

    // Set tooltip with table information
    this.tooltip = this.buildTooltip();

    // No command on click - just expand/collapse
  }

  /**
   * Builds a detailed tooltip showing table information.
   */
  private buildTooltip(): string {
    return `Table: ${this.keyspace}.${this.table}\n\nClick to expand and view columns\nRight-click for more actions`;
  }
}
