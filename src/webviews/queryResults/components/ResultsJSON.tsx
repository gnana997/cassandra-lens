/**
 * Results JSON component
 *
 * Displays query results as formatted JSON
 */

import { QueryResult } from '../types';

interface ResultsJSONProps {
  result: QueryResult;
  onCopyCell: (value: any) => void;
}

const ResultsJSON = ({ result }: ResultsJSONProps) => {
  // Format the results as a JSON array of objects
  const jsonData = result.rows.map(row => {
    const obj: any = {};
    result.columns.forEach(col => {
      obj[col.name] = row[col.name];
    });
    return obj;
  });

  const jsonString = JSON.stringify(jsonData, null, 2);

  return (
    <div className="json-view">
      <div className="json-content">
        <pre>{jsonString}</pre>
      </div>
      <div className="table-footer">
        <div className="result-stats">
          ✓ {result.rows.length} rows | ⏱ {result.executionTime}ms
          {result.tablePath && ` | 📍 ${result.tablePath}`}
        </div>
      </div>
    </div>
  );
};

export default ResultsJSON;
