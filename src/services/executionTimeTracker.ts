/**
 * Execution Time Tracker Service
 *
 * Tracks execution times for CQL statements and files in-memory.
 * Used by CodeLens to display last execution time.
 *
 * **Storage Strategy:**
 * - In-memory only (cleared on extension reload)
 * - Key format: `${documentUri}:${startLine}-${endLine}`
 * - Auto-cleanup: Max 100 entries per file (LRU)
 *
 * **Use Cases:**
 * - CodeLens: Show "⏱ Last: 23ms" for individual statements
 * - File-level: Show "⏱ Last run: 145ms total" for all statements
 * - Performance tracking: Identify slow queries during development
 */

/**
 * Execution record for a single statement or file.
 */
export interface ExecutionRecord {
  /**
   * Execution time in milliseconds
   */
  executionTime: number;

  /**
   * Number of rows returned/affected
   */
  rowCount: number;

  /**
   * Timestamp of when the execution occurred
   */
  timestamp: Date;

  /**
   * Whether the execution succeeded or failed
   */
  success: boolean;
}

/**
 * Tracks execution times for CQL statements and files.
 */
export class ExecutionTimeTracker {
  /**
   * Statement-level execution records.
   * Key: `${documentUri}:${startLine}-${endLine}`
   * Value: ExecutionRecord
   */
  private executions: Map<string, ExecutionRecord> = new Map();

  /**
   * File-level execution times (total for all statements).
   * Key: documentUri
   * Value: total execution time in milliseconds
   */
  private fileExecutions: Map<string, number> = new Map();

  /**
   * Maximum number of executions to track per file before cleanup.
   */
  private static readonly MAX_ENTRIES_PER_FILE = 100;

  /**
   * Records an execution for a specific statement.
   *
   * @param uri - Document URI as string
   * @param startLine - Statement start line (0-indexed)
   * @param endLine - Statement end line (0-indexed)
   * @param record - Execution record details
   */
  recordExecution(uri: string, startLine: number, endLine: number, record: ExecutionRecord): void {
    const key = this.makeKey(uri, startLine, endLine);
    this.executions.set(key, record);

    // Cleanup if needed
    this.cleanup(uri);
  }

  /**
   * Gets the last execution record for a specific statement.
   *
   * @param uri - Document URI as string
   * @param startLine - Statement start line (0-indexed)
   * @param endLine - Statement end line (0-indexed)
   * @returns Execution record if found, undefined otherwise
   */
  getLastExecution(uri: string, startLine: number, endLine: number): ExecutionRecord | undefined {
    const key = this.makeKey(uri, startLine, endLine);
    return this.executions.get(key);
  }

  /**
   * Records total execution time for a file (all statements combined).
   *
   * @param uri - Document URI as string
   * @param totalTime - Total execution time in milliseconds
   */
  recordFileExecution(uri: string, totalTime: number): void {
    this.fileExecutions.set(uri, totalTime);
  }

  /**
   * Gets the last total execution time for a file.
   *
   * @param uri - Document URI as string
   * @returns Total execution time if found, undefined otherwise
   */
  getFileExecutionTime(uri: string): number | undefined {
    return this.fileExecutions.get(uri);
  }

  /**
   * Clears all execution records for a specific file.
   * Useful when file is closed or deleted.
   *
   * @param uri - Document URI as string
   */
  clearFile(uri: string): void {
    // Remove all statement-level records for this file
    const keysToDelete: string[] = [];
    for (const key of this.executions.keys()) {
      if (key.startsWith(uri + ':')) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.executions.delete(key);
    }

    // Remove file-level record
    this.fileExecutions.delete(uri);
  }

  /**
   * Clears all execution records.
   * Useful for testing or manual cleanup.
   */
  clearAll(): void {
    this.executions.clear();
    this.fileExecutions.clear();
  }

  /**
   * Gets the number of execution records stored.
   * Useful for debugging and testing.
   *
   * @returns Total number of statement-level execution records
   */
  getRecordCount(): number {
    return this.executions.size;
  }

  /**
   * Creates a unique key for a statement execution record.
   *
   * @param uri - Document URI as string
   * @param startLine - Statement start line (0-indexed)
   * @param endLine - Statement end line (0-indexed)
   * @returns Unique key string
   * @private
   */
  private makeKey(uri: string, startLine: number, endLine: number): string {
    return `${uri}:${startLine}-${endLine}`;
  }

  /**
   * Performs LRU cleanup for a file if it has too many execution records.
   * Removes oldest 20 records when threshold (100) is exceeded.
   *
   * @param uri - Document URI as string
   * @private
   */
  private cleanup(uri: string): void {
    // Find all keys for this file
    const fileKeys: Array<{ key: string; timestamp: Date }> = [];

    for (const [key, record] of this.executions.entries()) {
      if (key.startsWith(uri + ':')) {
        fileKeys.push({ key, timestamp: record.timestamp });
      }
    }

    // Check if cleanup needed
    if (fileKeys.length <= ExecutionTimeTracker.MAX_ENTRIES_PER_FILE) {
      return;
    }

    // Sort by timestamp (oldest first)
    fileKeys.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Remove oldest 20 entries
    const toRemove = fileKeys.slice(0, 20);
    for (const item of toRemove) {
      this.executions.delete(item.key);
    }
  }
}

/**
 * Singleton instance of ExecutionTimeTracker.
 * Exported for use throughout the extension.
 */
export const executionTimeTracker = new ExecutionTimeTracker();
