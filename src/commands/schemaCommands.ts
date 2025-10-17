/**
 * Schema Commands
 *
 * Handles context menu commands for schema tree items:
 * - Copy names (keyspace, table, column)
 * - Browse table data
 * - Describe table structure
 * - Refresh schema nodes
 */

import * as vscode from 'vscode';
import { KeyspaceTreeItem } from '../providers/keyspaceTreeItem';
import { TableTreeItem } from '../providers/tableTreeItem';
import { ColumnTreeItem } from '../providers/columnTreeItem';
import { ConnectionTreeProvider } from '../providers/connectionTreeProvider';
import { SchemaService } from '../services/schemaService';

export class SchemaCommands {
  /**
   * Creates a new SchemaCommands instance.
   *
   * @param treeProvider - The connection tree provider for refreshing nodes
   * @param schemaService - The schema service for querying schema details
   */
  constructor(
    private readonly treeProvider: ConnectionTreeProvider,
    private readonly schemaService: SchemaService
  ) {}

  /**
   * Copies keyspace name to clipboard.
   */
  async copyKeyspaceName(item: KeyspaceTreeItem): Promise<void> {
    await vscode.env.clipboard.writeText(item.keyspace);
    vscode.window.showInformationMessage(`Copied keyspace name: ${item.keyspace}`);
  }

  /**
   * Copies table name to clipboard (qualified with keyspace).
   */
  async copyTableName(item: TableTreeItem): Promise<void> {
    const qualifiedName = `${item.keyspace}.${item.table}`;
    await vscode.env.clipboard.writeText(qualifiedName);
    vscode.window.showInformationMessage(`Copied table name: ${qualifiedName}`);
  }

  /**
   * Copies column name to clipboard.
   */
  async copyColumnName(item: ColumnTreeItem): Promise<void> {
    await vscode.env.clipboard.writeText(item.column);
    vscode.window.showInformationMessage(`Copied column name: ${item.column}`);
  }

  /**
   * Copies full column path to clipboard (keyspace.table.column).
   */
  async copyColumnPath(item: ColumnTreeItem): Promise<void> {
    const fullPath = `${item.keyspace}.${item.table}.${item.column}`;
    await vscode.env.clipboard.writeText(fullPath);
    vscode.window.showInformationMessage(`Copied column path: ${fullPath}`);
  }

  /**
   * Opens a query editor with SELECT statement for browsing table data.
   * TODO: Week 3 will implement actual query execution.
   */
  async browseTableData(item: TableTreeItem): Promise<void> {
    const query = `SELECT * FROM ${item.keyspace}.${item.table} LIMIT 100;`;

    // Create new untitled document with CQL query
    const doc = await vscode.workspace.openTextDocument({
      language: 'sql', // Using SQL for syntax highlighting until we have CQL
      content: query,
    });

    await vscode.window.showTextDocument(doc);
    vscode.window.showInformationMessage(
      `Query ready. Execute with "Run Query" command (Week 3 feature).`
    );
  }

  /**
   * Shows table structure with all columns, types, and keys.
   */
  async describeTable(item: TableTreeItem): Promise<void> {
    try {
      // Fetch columns from schema service
      const columns = await this.schemaService.getColumns(item.keyspace, item.table);

      if (columns.length === 0) {
        vscode.window.showInformationMessage('Table has no columns.');
        return;
      }

      // Build description text
      const lines: string[] = [
        `# Table: ${item.keyspace}.${item.table}`,
        '',
        '## Schema',
        '',
      ];

      // Partition keys
      const partitionKeys = columns.filter((col) => col.kind === 'partition_key');
      if (partitionKeys.length > 0) {
        lines.push('### Partition Keys');
        partitionKeys.forEach((col) => {
          lines.push(`- **${col.name}** (${col.type})`);
        });
        lines.push('');
      }

      // Clustering keys
      const clusteringKeys = columns.filter((col) => col.kind === 'clustering');
      if (clusteringKeys.length > 0) {
        lines.push('### Clustering Keys');
        clusteringKeys.forEach((col) => {
          lines.push(`- **${col.name}** (${col.type})`);
        });
        lines.push('');
      }

      // Static columns
      const staticCols = columns.filter((col) => col.kind === 'static');
      if (staticCols.length > 0) {
        lines.push('### Static Columns');
        staticCols.forEach((col) => {
          lines.push(`- **${col.name}** (${col.type})`);
        });
        lines.push('');
      }

      // Regular columns
      const regularCols = columns.filter((col) => col.kind === 'regular');
      if (regularCols.length > 0) {
        lines.push('### Regular Columns');
        regularCols.forEach((col) => {
          lines.push(`- **${col.name}** (${col.type})`);
        });
        lines.push('');
      }

      // Create CQL statement
      lines.push('## CREATE TABLE Statement');
      lines.push('```sql');
      lines.push(this.generateCreateTableStatement(item, columns));
      lines.push('```');

      // Open in new document
      const doc = await vscode.workspace.openTextDocument({
        language: 'markdown',
        content: lines.join('\n'),
      });

      await vscode.window.showTextDocument(doc);
    } catch (error) {
      console.error('Failed to describe table:', error);
      vscode.window.showErrorMessage(
        `Failed to describe table: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Refreshes a schema node (clears cache and reloads).
   */
  async refreshNode(item: vscode.TreeItem): Promise<void> {
    this.treeProvider.refresh(item);

    // Provide feedback based on node type
    if (item instanceof KeyspaceTreeItem) {
      vscode.window.showInformationMessage(`Refreshed keyspace: ${item.keyspace}`);
    } else if (item instanceof TableTreeItem) {
      vscode.window.showInformationMessage(`Refreshed table: ${item.table}`);
    } else if (item instanceof ColumnTreeItem) {
      vscode.window.showInformationMessage(`Refreshed column: ${item.column}`);
    }
  }

  /**
   * Generates a CREATE TABLE statement approximation from column metadata.
   * Note: This is a simplified version. Full replication options and other
   * table properties would require querying system_schema.tables as well.
   *
   * @private
   */
  private generateCreateTableStatement(
    item: TableTreeItem,
    columns: Array<{ name: string; type: string; kind: string; position: number }>
  ): string {
    const partitionKeys = columns
      .filter((col) => col.kind === 'partition_key')
      .sort((a, b) => a.position - b.position);

    const clusteringKeys = columns
      .filter((col) => col.kind === 'clustering')
      .sort((a, b) => a.position - b.position);

    const staticCols = columns.filter((col) => col.kind === 'static');
    const regularCols = columns.filter((col) => col.kind === 'regular');

    const lines: string[] = [`CREATE TABLE ${item.keyspace}.${item.table} (`];

    // Add all columns
    const allCols = [...columns].sort((a, b) => {
      // Sort by kind priority, then position
      const kindOrder: Record<string, number> = {
        partition_key: 1,
        clustering: 2,
        static: 3,
        regular: 4,
      };
      const kindDiff = (kindOrder[a.kind] || 99) - (kindOrder[b.kind] || 99);
      if (kindDiff !== 0) return kindDiff;
      return a.position - b.position;
    });

    allCols.forEach((col, idx) => {
      const staticKeyword = col.kind === 'static' ? ' STATIC' : '';
      const comma = idx < allCols.length - 1 ? ',' : '';
      lines.push(`  ${col.name} ${col.type}${staticKeyword}${comma}`);
    });

    // Add PRIMARY KEY clause
    const pkParts: string[] = [];

    if (partitionKeys.length === 1) {
      pkParts.push(partitionKeys[0].name);
    } else if (partitionKeys.length > 1) {
      pkParts.push(`(${partitionKeys.map((pk) => pk.name).join(', ')})`);
    }

    if (clusteringKeys.length > 0) {
      pkParts.push(...clusteringKeys.map((ck) => ck.name));
    }

    if (pkParts.length > 0) {
      lines.push(`  PRIMARY KEY (${pkParts.join(', ')})`);
    }

    lines.push(');');

    return lines.join('\n');
  }
}
