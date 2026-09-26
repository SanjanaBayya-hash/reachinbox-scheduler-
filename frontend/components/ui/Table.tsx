export interface Column<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
  key: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyMessage?: string;
}

export function Table<T>({ columns, rows, rowKey, loading, emptyMessage }: TableProps<T>) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-card bg-gray-100" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-gray-300 py-12 text-center text-sm text-gray-500">
        {emptyMessage ?? 'Nothing here yet.'}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-2 text-left font-medium text-gray-600">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-2 text-gray-800">
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
