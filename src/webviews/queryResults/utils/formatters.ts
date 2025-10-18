/**
 * Data type formatters for Cassandra values
 *
 * Formats different Cassandra data types for display in the results table
 */

/**
 * Format a cell value for display
 */
export function formatValue(value: any, dataType: string): { display: string; className: string } {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return { display: '(null)', className: 'cell-null' };
  }

  // UUID/TIMEUUID - show shortened version with full value in title
  if (dataType.toLowerCase().includes('uuid')) {
    const uuidStr = String(value);
    return {
      display: `${uuidStr.substring(0, 8)}...${uuidStr.substring(uuidStr.length - 4)}`,
      className: 'cell-uuid'
    };
  }

  // TIMESTAMP - format as human-readable date
  if (dataType.toLowerCase() === 'timestamp') {
    try {
      const date = value instanceof Date ? value : new Date(value);
      return {
        display: date.toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }),
        className: 'cell-value'
      };
    } catch {
      return { display: String(value), className: 'cell-value' };
    }
  }

  // BOOLEAN - show true/false
  if (typeof value === 'boolean') {
    return {
      display: value ? 'true ✓' : 'false ✗',
      className: 'cell-value'
    };
  }

  // Numbers - format with commas
  if (typeof value === 'number') {
    return {
      display: value.toLocaleString(),
      className: 'cell-number'
    };
  }

  // Collections (arrays, objects) - compact JSON representation
  if (typeof value === 'object') {
    try {
      const jsonStr = JSON.stringify(value);
      // Truncate long JSON strings
      if (jsonStr.length > 100) {
        return {
          display: jsonStr.substring(0, 100) + '...',
          className: 'cell-collection'
        };
      }
      return { display: jsonStr, className: 'cell-collection' };
    } catch {
      return { display: String(value), className: 'cell-value' };
    }
  }

  // Default: convert to string
  return { display: String(value), className: 'cell-value' };
}

/**
 * Get the full value as a string (for tooltips and copying)
 */
export function getFullValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

/**
 * Sort comparison function for values
 */
export function compareValues(a: any, b: any, direction: 'asc' | 'desc'): number {
  // Handle nulls - always sort to end
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;

  // Numeric comparison
  if (typeof a === 'number' && typeof b === 'number') {
    return direction === 'asc' ? a - b : b - a;
  }

  // Date comparison
  if (a instanceof Date && b instanceof Date) {
    return direction === 'asc'
      ? a.getTime() - b.getTime()
      : b.getTime() - a.getTime();
  }

  // String comparison (case-insensitive)
  const aStr = String(a).toLowerCase();
  const bStr = String(b).toLowerCase();

  if (direction === 'asc') {
    return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
  } else {
    return aStr > bStr ? -1 : aStr < bStr ? 1 : 0;
  }
}
