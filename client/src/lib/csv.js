import toast from 'react-hot-toast';
import { IS_DEMO } from '../api/axios';

const toCSV = (rows, columns) => {
  const escape = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    columns.map((c) => escape(c.header)).join(','),
    ...rows.map((r) => columns.map((c) => escape(c.csv(r))).join(',')),
  ].join('\n');
};

// Downloads rows as a CSV file. columns: [{ header, csv: (row) => value }].
// The hosted demo runs in a sandbox that blocks downloads, so there the CSV
// is copied to the clipboard instead.
export async function downloadCSV(filename, rows, columns) {
  const csv = toCSV(rows, columns);

  if (IS_DEMO) {
    try {
      await navigator.clipboard.writeText(csv);
      toast.success(`${rows.length} rows copied as CSV — paste into a spreadsheet`);
    } catch {
      toast.error('Clipboard is not available in this browser');
    }
    return;
  }

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
