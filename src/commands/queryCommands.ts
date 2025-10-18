/**
 * Query Commands
 *
 * Handles CQL query execution commands:
 * - Execute query (Ctrl+Enter)
 * - New query file
 * - Query parsing and validation
 */

import * as vscode from 'vscode';
import { ConnectionManager } from '../services/connectionManager';
import { ConnectionStorage } from '../services/connectionStorage';
import { QueryResultsPanel, QueryResult, QueryError } from '../webviews/QueryResultsPanel';
import { executionTimeTracker } from '../services/executionTimeTracker';

export class QueryCommands {
  /**
   * Creates a new QueryCommands instance.
   *
   * @param connectionManager - The connection manager for executing queries
   * @param connectionStorage - The connection storage for looking up connections by name
   * @param extensionUri - The extension URI for creating webview panels
   */
  constructor(
    private readonly connectionManager: ConnectionManager,
    private readonly connectionStorage: ConnectionStorage,
    private readonly extensionUri: vscode.Uri
  ) {}

  /**
   * Creates a new CQL query file in the editor.
   */
  async newQuery(): Promise<void> {
    const document = await vscode.workspace.openTextDocument({
      language: 'cql',
      content: `-- New CQL Query
-- Press Ctrl+Enter (Cmd+Enter on Mac) to execute

SELECT * FROM
`
    });

    await vscode.window.showTextDocument(document);
  }

  /**
   * Executes the query in the active editor.
   * Executes selected text if selection exists, otherwise entire file.
   * Handles multiple statements (semicolon-separated) by executing them sequentially.
   */
  async executeQuery(): Promise<void> {
    // Get active text editor
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor found. Open a .cql file to execute queries.');
      return;
    }

    // Check if it's a CQL file (optional - allow execution from any file)
    // const isCQLFile = editor.document.languageId === 'cql';

    // Get query text (selection or entire document)
    let queryText: string;
    const selection = editor.selection;
    if (!selection.isEmpty) {
      // Execute selected text
      queryText = editor.document.getText(selection);
    } else {
      // Execute entire document
      queryText = editor.document.getText();
    }

    // Trim and validate
    queryText = queryText.trim();
    if (!queryText) {
      vscode.window.showWarningMessage('No query text to execute. Select text or ensure file is not empty.');
      return;
    }

    // Check connection
    if (!this.connectionManager.isConnected()) {
      const connect = await vscode.window.showWarningMessage(
        'Not connected to a Cassandra cluster. Connect first?',
        'Connect'
      );
      if (connect === 'Connect') {
        await vscode.commands.executeCommand('cassandra-lens.switchConnection');
      }
      return;
    }

    // Split into statements (semicolon-separated)
    const statements = this.parseStatements(queryText);

    if (statements.length === 0) {
      vscode.window.showWarningMessage('No valid statements found.');
      return;
    }

    // Show or create results panel
    const resultsPanel = QueryResultsPanel.createOrShow(this.extensionUri);

    // Track total execution time for file-level CodeLens
    let totalExecutionTime = 0;

    // Execute statements sequentially
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const isLastStatement = i === statements.length - 1;

      // Check for @conn directive before this statement
      const targetConnectionName = this.findConnectionDirectiveInDocument(editor.document, statement);

      if (targetConnectionName) {
        const currentConnectionName = this.connectionManager.getActiveConnectionName();
        const shouldProceed = await this.handleConnectionSwitch(targetConnectionName, currentConnectionName);

        if (!shouldProceed) {
          // User cancelled the connection switch
          vscode.window.showInformationMessage('Query execution cancelled by user.');
          break;
        }
      }

      // Show executing state
      resultsPanel.showExecuting(statement);

      try {
        // Execute and measure time
        const startTime = Date.now();
        const client = this.connectionManager.getActiveClient();
        if (!client) {
          throw new Error('Not connected to cluster');
        }
        const result = await client.execute(statement);
        const executionTime = Date.now() - startTime;

        // Accumulate total execution time
        totalExecutionTime += executionTime;

        // Extract table path from query (if SELECT statement)
        const tablePath = this.extractTablePath(statement);

        // Format columns metadata
        const columns = result.columns?.map((col: any) => ({
          name: col.name,
          type: col.type?.options?.type || col.type?.code?.toString() || 'unknown'
        })) || [];

        // Convert rows to plain objects
        // Note: DDL/DML statements (CREATE, INSERT, UPDATE, DELETE) don't return rows
        const rows = result.rows?.map((row: any) => {
          const obj: any = {};
          columns.forEach((col: any) => {
            obj[col.name] = row[col.name];
          });
          return obj;
        }) || [];

        // Build result object
        const queryResult: QueryResult = {
          columns,
          rows,
          executionTime,
          tablePath,
          query: statement
        };

        // Show results (only for last statement, or if there's only one)
        if (isLastStatement || statements.length === 1) {
          resultsPanel.showResults(queryResult);
        }

        // Show success message in status bar
        const message = statements.length > 1
          ? this.getCompletionMessage(executionTime, rows.length, i + 1, statements.length)
          : this.getCompletionMessage(executionTime, rows.length);
        this.showStatusBarMessage(message);

      } catch (error) {
        // Handle execution error
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        const suggestion = this.getSuggestionForError(errorMessage);

        const queryError: QueryError = {
          message: errorMessage,
          suggestion,
          query: statement
        };

        resultsPanel.showError(queryError);

        // Show error notification
        vscode.window.showErrorMessage(
          `Query execution failed: ${errorMessage.substring(0, 100)}${errorMessage.length > 100 ? '...' : ''}`
        );

        // Stop execution for multi-statement queries
        if (statements.length > 1) {
          vscode.window.showWarningMessage(
            `Stopped at statement ${i + 1}/${statements.length} due to error.`
          );
        }

        // Stop on first error
        break;
      }
    }

    // Record total file execution time if at least one statement executed
    if (totalExecutionTime > 0) {
      executionTimeTracker.recordFileExecution(editor.document.uri.toString(), totalExecutionTime);
    }
  }

  /**
   * Executes a specific CQL statement at the given line range.
   * Called from CodeLens "Run" button for individual statements.
   *
   * @param uriString - Document URI as string
   * @param startLine - Statement start line (0-indexed)
   * @param endLine - Statement end line (0-indexed)
   */
  async executeStatementAtLine(uriString: string, startLine: number, endLine: number): Promise<void> {
    try {
      // Parse URI and find document
      const uri = vscode.Uri.parse(uriString);
      const document = await vscode.workspace.openTextDocument(uri);

      // Extract statement text from line range
      const range = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
      let statementText = document.getText(range).trim();

      // Remove trailing semicolon if present
      if (statementText.endsWith(';')) {
        statementText = statementText.slice(0, -1).trim();
      }

      if (!statementText) {
        vscode.window.showWarningMessage('No statement text found at specified line range.');
        return;
      }

      // Check connection
      if (!this.connectionManager.isConnected()) {
        const connect = await vscode.window.showWarningMessage(
          'Not connected to a Cassandra cluster. Connect first?',
          'Connect'
        );
        if (connect === 'Connect') {
          await vscode.commands.executeCommand('cassandra-lens.switchConnection');
        }
        return;
      }

      // Check for @conn directive
      const targetConnectionName = this.findConnectionDirectiveInDocument(document, statementText);
      if (targetConnectionName) {
        const currentConnectionName = this.connectionManager.getActiveConnectionName();
        const shouldProceed = await this.handleConnectionSwitch(targetConnectionName, currentConnectionName);

        if (!shouldProceed) {
          vscode.window.showInformationMessage('Query execution cancelled by user.');
          return;
        }
      }

      // Show or create results panel
      const resultsPanel = QueryResultsPanel.createOrShow(this.extensionUri);
      resultsPanel.showExecuting(statementText);

      try {
        // Execute and measure time
        const startTime = Date.now();
        const client = this.connectionManager.getActiveClient();
        if (!client) {
          throw new Error('Not connected to cluster');
        }
        const result = await client.execute(statementText);
        const executionTime = Date.now() - startTime;

        // Extract table path from query
        const tablePath = this.extractTablePath(statementText);

        // Format columns metadata
        const columns = result.columns?.map((col: any) => ({
          name: col.name,
          type: col.type?.options?.type || col.type?.code?.toString() || 'unknown'
        })) || [];

        // Convert rows to plain objects
        // Note: DDL/DML statements (CREATE, INSERT, UPDATE, DELETE) don't return rows
        const rows = result.rows?.map((row: any) => {
          const obj: any = {};
          columns.forEach((col: any) => {
            obj[col.name] = row[col.name];
          });
          return obj;
        }) || [];

        // Build result object
        const queryResult: QueryResult = {
          columns,
          rows,
          executionTime,
          tablePath,
          query: statementText
        };

        // Record execution in tracker
        executionTimeTracker.recordExecution(uriString, startLine, endLine, {
          executionTime,
          rowCount: rows.length,
          timestamp: new Date(),
          success: true
        });

        // Show results
        resultsPanel.showResults(queryResult);

        // Show success message
        const message = this.getCompletionMessage(executionTime, rows.length);
        this.showStatusBarMessage(message);

        // Refresh CodeLens to show updated execution time
        vscode.commands.executeCommand('vscode.executeCodeLensProvider', uri);

      } catch (error) {
        // Handle execution error
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        const suggestion = this.getSuggestionForError(errorMessage);

        const queryError: QueryError = {
          message: errorMessage,
          suggestion,
          query: statementText
        };

        // Record failed execution
        executionTimeTracker.recordExecution(uriString, startLine, endLine, {
          executionTime: 0,
          rowCount: 0,
          timestamp: new Date(),
          success: false
        });

        resultsPanel.showError(queryError);

        // Show error notification
        vscode.window.showErrorMessage(
          `Query execution failed: ${errorMessage.substring(0, 100)}${errorMessage.length > 100 ? '...' : ''}`
        );

        // Refresh CodeLens to show error status
        vscode.commands.executeCommand('vscode.executeCodeLensProvider', uri);
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to execute statement: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Finds a connection directive (-- @conn connectionName) in the document before a statement.
   * Looks backwards from the statement start position up to 10 lines or until a blank line.
   *
   * @param document - The document to search
   * @param statementText - The statement text to find
   * @returns Connection name if found, undefined otherwise
   */
  private findConnectionDirectiveInDocument(
    document: vscode.TextDocument,
    statementText: string
  ): string | undefined {
    const text = document.getText();
    const statementIndex = text.indexOf(statementText);

    if (statementIndex === -1) {
      return undefined;
    }

    // Find the line number where this statement starts
    const beforeStatement = text.substring(0, statementIndex);
    const startLine = beforeStatement.split('\n').length - 1;

    // Look backwards up to 10 lines for @conn directive
    for (let i = startLine; i >= 0 && i >= startLine - 10; i--) {
      const line = document.lineAt(i).text.trim();

      // Stop at blank lines
      if (line === '') {
        break;
      }

      // Check for @conn directive
      const match = line.match(/^--\s*@conn\s+(.+)$/i);
      if (match) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * Handles connection switching based on @conn directive.
   * Prompts user if warnOnConnectionSwitch is enabled.
   *
   * @param targetConnectionName - Name of connection to switch to
   * @param currentConnectionName - Name of currently active connection
   * @returns True if switch was successful or user chose to proceed, false if cancelled
   */
  private async handleConnectionSwitch(
    targetConnectionName: string,
    currentConnectionName: string | null
  ): Promise<boolean> {
    // Check if target connection exists
    const targetProfile = await this.connectionStorage.findConnectionByName(targetConnectionName);

    if (!targetProfile) {
      vscode.window.showErrorMessage(
        `Connection '${targetConnectionName}' not found. Please check your @conn directive.`
      );
      return false;
    }

    // Check if we're already on the target connection
    if (currentConnectionName === targetConnectionName) {
      return true; // No switch needed
    }

    // Check if user wants to be warned
    const config = vscode.workspace.getConfiguration('cassandraLens.editor');
    const warnOnSwitch = config.get<boolean>('warnOnConnectionSwitch', true);

    if (warnOnSwitch) {
      const action = await vscode.window.showWarningMessage(
        `This statement uses connection '${targetConnectionName}' but you're connected to '${currentConnectionName || 'no connection'}'. Switch and run?`,
        { modal: false },
        'Switch & Run',
        'Cancel'
      );

      if (action !== 'Switch & Run') {
        return false; // User cancelled
      }
    }

    // Attempt to switch connection
    try {
      await this.connectionManager.switchConnection(targetProfile);
      vscode.window.showInformationMessage(`Switched to connection: ${targetConnectionName}`);
      return true;
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to switch to connection '${targetConnectionName}': ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return false;
    }
  }

  /**
   * Parses query text into individual statements.
   * Splits by semicolons, but preserves semicolons inside strings.
   *
   * @param queryText - The full query text
   * @returns Array of individual statements
   */
  private parseStatements(queryText: string): string[] {
    const statements: string[] = [];
    let currentStatement = '';
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < queryText.length; i++) {
      const char = queryText[i];
      const prevChar = i > 0 ? queryText[i - 1] : '';

      // Track string boundaries (single and double quotes)
      if ((char === "'" || char === '"') && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
          stringChar = '';
        }
      }

      // Split on semicolons outside of strings
      if (char === ';' && !inString) {
        const trimmed = currentStatement.trim();
        if (trimmed) {
          statements.push(trimmed);
        }
        currentStatement = '';
      } else {
        currentStatement += char;
      }
    }

    // Add final statement if it doesn't end with semicolon
    const trimmed = currentStatement.trim();
    if (trimmed) {
      statements.push(trimmed);
    }

    return statements.filter(stmt => {
      // Filter out comments-only statements
      const withoutComments = stmt
        .replace(/--.*$/gm, '') // Remove line comments
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
        .trim();
      return withoutComments.length > 0;
    });
  }

  /**
   * Attempts to extract table path (keyspace.table) from a SELECT query.
   *
   * @param query - The query statement
   * @returns Table path if found, undefined otherwise
   */
  private extractTablePath(query: string): string | undefined {
    // Simple regex to extract "FROM keyspace.table" or "FROM table"
    const match = query.match(/FROM\s+([\w]+\.[\w]+|[\w]+)/i);
    return match ? match[1] : undefined;
  }

  /**
   * Formats a completion message based on user settings.
   *
   * @param executionTime - Execution time in milliseconds
   * @param rowCount - Number of rows returned
   * @param statementIndex - Optional statement index for multi-statement queries
   * @param totalStatements - Optional total number of statements
   * @returns Formatted completion message
   */
  private getCompletionMessage(
    executionTime: number,
    rowCount: number,
    statementIndex?: number,
    totalStatements?: number
  ): string {
    const config = vscode.workspace.getConfiguration('cassandraLens.query');
    const format = config.get<string>('completionMessageFormat', 'detailed');

    // Multi-statement prefix
    const prefix = statementIndex !== undefined && totalStatements !== undefined
      ? `[${statementIndex}/${totalStatements}] `
      : '';

    switch (format) {
      case 'minimal':
        return `${prefix}✓ ${executionTime}ms`;

      case 'verbose':
        const rowText = rowCount === 1 ? 'row' : 'rows';
        return `${prefix}✓ Query executed successfully • ${rowCount} ${rowText} • ${executionTime}ms`;

      case 'detailed':
      default:
        return `${prefix}✓ Query executed (${executionTime}ms, ${rowCount} ${rowCount === 1 ? 'row' : 'rows'})`;
    }
  }

  /**
   * Shows a temporary status bar message.
   *
   * @param message - Message to display
   */
  private showStatusBarMessage(message: string): void {
    const config = vscode.workspace.getConfiguration('cassandraLens.query');
    const duration = config.get<number>('completionMessageDuration', 3000);
    vscode.window.setStatusBarMessage(message, duration);
  }

  /**
   * Provides helpful suggestions based on common error messages.
   *
   * @param errorMessage - The error message from Cassandra
   * @returns Suggestion text, or undefined if no suggestion
   */
  private getSuggestionForError(errorMessage: string): string | undefined {
    const lowerMsg = errorMessage.toLowerCase();

    if (lowerMsg.includes('unauthorized')) {
      return 'Check your connection credentials. You may not have permission to access this resource.';
    }

    if (lowerMsg.includes('keyspace') && lowerMsg.includes('does not exist')) {
      return 'The keyspace does not exist. Check the keyspace name or create it first.';
    }

    if (lowerMsg.includes('table') && lowerMsg.includes('does not exist')) {
      return 'The table does not exist. Check the table name or create it first.';
    }

    if (lowerMsg.includes('syntax error') || lowerMsg.includes('invalid syntax')) {
      return 'Check your CQL syntax. Common issues: missing semicolons, incorrect keywords, or invalid identifiers.';
    }

    if (lowerMsg.includes('allow filtering')) {
      return 'This query requires ALLOW FILTERING. Add it to the end of your query, but be aware it may be slow on large tables.';
    }

    if (lowerMsg.includes('partition key')) {
      return 'You must include the partition key in your WHERE clause, or use ALLOW FILTERING.';
    }

    if (lowerMsg.includes('timeout') || lowerMsg.includes('timed out')) {
      return 'Query timed out. Try adding a LIMIT clause or filtering to reduce the result set.';
    }

    if (lowerMsg.includes('cannot execute') && lowerMsg.includes('consistency')) {
      return 'Not enough replicas are available. Check your cluster health and consistency level settings.';
    }

    return undefined;
  }
}
