import clsx from 'clsx';
import type { SyncRow } from '../types';

const STATUS_DOT: Record<SyncRow['status'], string> = {
  green: 'bg-green-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
};

const ROW_BG: Record<SyncRow['status'], string> = {
  green: '',
  yellow: 'bg-amber-50 dark:bg-amber-950/40',
  red: 'bg-red-50 dark:bg-red-950/40',
};

export function SyncReport({ rows, onRowClick }: { rows: SyncRow[]; onRowClick: (idx: number) => void }) {
  if (rows.length === 0) return null;
  const redCount = rows.filter((r) => r.status === 'red').length;
  const yellowCount = rows.filter((r) => r.status === 'yellow').length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Sync report</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {redCount} red, {yellowCount} yellow
        </p>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-xs">
          <thead>
            <tr className="text-slate-500 dark:text-slate-400">
              <th className="py-1.5 pr-3 font-medium">#</th>
              <th className="py-1.5 pr-3 font-medium">Start</th>
              <th className="py-1.5 pr-3 font-medium">Available (s)</th>
              <th className="py-1.5 pr-3 font-medium">Audio (s)</th>
              <th className="py-1.5 pr-3 font-medium">Speed</th>
              <th className="py-1.5 pr-3 font-medium">Overflow (s)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.idx}
                onClick={() => onRowClick(row.idx)}
                className={clsx(
                  'cursor-pointer border-t border-slate-100 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/40',
                  ROW_BG[row.status]
                )}
              >
                <td className="py-1.5 pr-3 font-medium text-slate-700 dark:text-slate-200">
                  <span className={clsx('mr-1.5 inline-block h-2 w-2 rounded-full', STATUS_DOT[row.status])} />
                  {row.idx + 1}
                </td>
                <td className="py-1.5 pr-3 text-slate-600 dark:text-slate-300">{row.start.toFixed(1)}</td>
                <td className="py-1.5 pr-3 text-slate-600 dark:text-slate-300">{row.available.toFixed(1)}</td>
                <td className="py-1.5 pr-3 text-slate-600 dark:text-slate-300">{row.audio.toFixed(1)}</td>
                <td className="py-1.5 pr-3 text-slate-600 dark:text-slate-300">{row.speed.toFixed(2)}&times;</td>
                <td className="py-1.5 pr-3 text-slate-600 dark:text-slate-300">{row.overflow_sec.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
