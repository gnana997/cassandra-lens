/**
 * Results Table component
 *
 * Displays query results in a sortable, paginated table
 */

import { useMemo } from 'react';
import { QueryResult } from '../types';
import { formatValue, getFullValue, compareValues } from '../utils/formatters';

interface ResultsTableProps {
  result: QueryResult;
  currentPage: number;
  rowsPerPage: number;
  defaultPageSize: number;
  sortColumn?: string;
  sortDirection: 'asc' | 'desc';
  onPageChange: (page: number) => void;
  onSort: (column: string) => void;
  onCopyCell: (value: any) => void;
  onRowsPerPageChange: (newSize: number) => void;
  onResetPageSize: () => void;
}

const ResultsTable = ({
  result,
  currentPage,
  rowsPerPage,
  defaultPageSize,
  sortColumn,
  sortDirection,
  onPageChange,
  onSort,
  onCopyCell,
  onRowsPerPageChange,
  onResetPageSize
}: ResultsTableProps) => {
  // Apply sorting
  const sortedRows = useMemo(() => {
    if (!sortColumn) {
      return result.rows;
    }

    return [...result.rows].sort((a, b) => {
      return compareValues(a[sortColumn], b[sortColumn], sortDirection);
    });
  }, [result.rows, sortColumn, sortDirection]);

  // Apply pagination
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return sortedRows.slice(startIndex, endIndex);
  }, [sortedRows, currentPage, rowsPerPage]);

  // Calculate pagination info
  const totalRows = result.rows.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const startRow = (currentPage - 1) * rowsPerPage + 1;
  const endRow = Math.min(currentPage * rowsPerPage, totalRows);

  const handleCellClick = (value: any) => {
    onCopyCell(getFullValue(value));
  };

  return (
    <div className="table-view">
      <div className="table-wrapper">
        <table className="results-table">
          <thead>
            <tr>
              {result.columns.map(col => (
                <th key={col.name} onClick={() => onSort(col.name)}>
                  <div className="column-header">
                    <span>{col.name}</span>
                    <span className="sort-indicator">
                      {sortColumn === col.name ? (
                        sortDirection === 'asc' ? '↑' : '↓'
                      ) : (
                        '↕'
                      )}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {result.columns.map(col => {
                  const value = row[col.name];
                  const { display, className } = formatValue(value, col.type);
                  const fullValue = getFullValue(value);

                  return (
                    <td
                      key={col.name}
                      className={className}
                      title={fullValue}
                      onClick={() => handleCellClick(value)}
                    >
                      <span className="cell-value">{display}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {totalRows === 0 && (
          <div className="empty-state" style={{ padding: '2rem' }}>
            <p>No rows returned</p>
          </div>
        )}
      </div>

      {/* Footer with stats and pagination */}
      <div className="table-footer">
        <div className="result-stats">
          ✓ Showing {totalRows > 0 ? `${startRow}-${endRow} of ${totalRows}` : '0'} rows
          {' | '}⏱ {result.executionTime}ms
          {result.tablePath && ` | 📍 ${result.tablePath}`}
        </div>

        <div className="pagination-controls">
          <div className="page-size-selector">
            <label>Rows per page:</label>
            <select
              value={rowsPerPage}
              onChange={(e) => onRowsPerPageChange(Number(e.target.value))}
              className="page-size-dropdown"
            >
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
            </select>
            <button
              className="reset-button"
              onClick={onResetPageSize}
              title={`Reset to default (${defaultPageSize})`}
              disabled={rowsPerPage === defaultPageSize}
            >
              ⟲
            </button>
            {rowsPerPage !== defaultPageSize && (
              <span className="default-indicator" title="Using custom page size">
                (default: {defaultPageSize})
              </span>
            )}
          </div>

          {totalPages > 1 && (
            <>
              <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                ← Previous
              </button>

              <span className="page-info">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultsTable;
