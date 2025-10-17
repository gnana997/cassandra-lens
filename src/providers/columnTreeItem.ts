/**
 * Tree item representing a Cassandra column in the schema tree.
 *
 * Columns are leaf nodes (not expandable). They display column name, type,
 * and are visually distinguished based on their kind (partition key, clustering key, etc.).
 */

import * as vscode from 'vscode';
import { SchemaTreeItem, SchemaNodeType } from './schemaTreeItem';

/**
 * Column kinds in Cassandra schema.
 * Determines the icon and context value for the column.
 */
export enum ColumnKind {
  PartitionKey = 'partition_key',
  Clustering = 'clustering',
  Regular = 'regular',
  Static = 'static',
}

export class ColumnTreeItem extends SchemaTreeItem {
  public readonly nodeType = SchemaNodeType.Column;
  public readonly keyspace: string;
  public readonly table: string;
  public readonly column: string;
  public readonly columnType: string;
  public readonly columnKind: ColumnKind;

  /**
   * Creates a tree item for a column.
   *
   * @param keyspaceName - Name of the keyspace this column belongs to
   * @param tableName - Name of the table this column belongs to
   * @param columnName - Name of the column
   * @param dataType - CQL data type (e.g., "text", "uuid", "timestamp")
   * @param kind - Column kind (partition_key, clustering, regular, static)
   */
  constructor(
    keyspaceName: string,
    tableName: string,
    columnName: string,
    dataType: string,
    kind: string
  ) {
    // Columns are leaf nodes (not collapsible)
    super(columnName, vscode.TreeItemCollapsibleState.None);

    this.keyspace = keyspaceName;
    this.table = tableName;
    this.column = columnName;
    this.columnType = dataType;
    this.columnKind = kind as ColumnKind;

    // Set description showing data type and kind indicator
    this.description = this.buildDescription();

    // Set icon based on column kind
    this.iconPath = this.getIcon();

    // Set context value for conditional menus
    this.contextValue = this.getContextValue();

    // Set tooltip with column details
    this.tooltip = this.buildTooltip();
  }

  /**
   * Builds the description shown next to the column name.
   * Includes data type and special indicators for key columns.
   */
  private buildDescription(): string {
    const kindLabel = this.getKindLabel();
    return kindLabel ? `${this.columnType} ${kindLabel}` : this.columnType;
  }

  /**
   * Gets a short label for the column kind.
   */
  private getKindLabel(): string {
    switch (this.columnKind) {
      case ColumnKind.PartitionKey:
        return '(PK)';
      case ColumnKind.Clustering:
        return '(CK)';
      case ColumnKind.Static:
        return '(static)';
      default:
        return '';
    }
  }

  /**
   * Returns the appropriate icon based on column kind.
   */
  private getIcon(): vscode.ThemeIcon {
    switch (this.columnKind) {
      case ColumnKind.PartitionKey:
        // Key icon for partition keys
        return new vscode.ThemeIcon('key', new vscode.ThemeColor('charts.yellow'));
      case ColumnKind.Clustering:
        // Symbol-numeric icon for clustering keys
        return new vscode.ThemeIcon(
          'symbol-numeric',
          new vscode.ThemeColor('charts.blue')
        );
      case ColumnKind.Static:
        // Symbol-constant icon for static columns
        return new vscode.ThemeIcon(
          'symbol-constant',
          new vscode.ThemeColor('charts.purple')
        );
      default:
        // Default field icon for regular columns
        return new vscode.ThemeIcon('symbol-field');
    }
  }

  /**
   * Gets context value for conditional context menus.
   */
  private getContextValue(): string {
    switch (this.columnKind) {
      case ColumnKind.PartitionKey:
        return 'column-partition-key';
      case ColumnKind.Clustering:
        return 'column-clustering';
      case ColumnKind.Static:
        return 'column-static';
      default:
        return 'column-regular';
    }
  }

  /**
   * Builds a detailed tooltip showing column information.
   */
  private buildTooltip(): string {
    const lines = [
      `Column: ${this.column}`,
      `Type: ${this.columnType}`,
      `Kind: ${this.getKindDescription()}`,
      `Table: ${this.keyspace}.${this.table}`,
    ];

    return lines.join('\n');
  }

  /**
   * Gets a human-readable description of the column kind.
   */
  private getKindDescription(): string {
    switch (this.columnKind) {
      case ColumnKind.PartitionKey:
        return 'Partition Key - Determines data distribution across cluster';
      case ColumnKind.Clustering:
        return 'Clustering Key - Determines sort order within partition';
      case ColumnKind.Static:
        return 'Static - Shared across all rows in partition';
      default:
        return 'Regular Column';
    }
  }
}
