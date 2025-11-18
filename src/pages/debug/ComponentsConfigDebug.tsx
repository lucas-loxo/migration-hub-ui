// [MH-AI] Debug view for ComponentsConfig
import React from 'react';
import { COMPONENTS_CONFIG } from '../../config/index';

export default function ComponentsConfigDebug() {
  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Components Config</h1>
      {COMPONENTS_CONFIG.length === 0 ? (
        <div className="text-slate-500">No component configs loaded. Run <code className="bg-slate-100 px-2 py-1 rounded">npm run publish:components</code> to sync from Sheets.</div>
      ) : (
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left pr-4 pb-2">ID</th>
              <th className="text-left pr-4 pb-2">Label</th>
              <th className="text-left pr-4 pb-2">Type</th>
              <th className="text-left pr-4 pb-2">Sheet</th>
              <th className="text-left pr-4 pb-2">Range</th>
              <th className="text-left pr-4 pb-2">Depends On</th>
              <th className="text-left pr-4 pb-2">Props</th>
            </tr>
          </thead>
          <tbody>
            {COMPONENTS_CONFIG.map((c) => (
              <tr key={c.component_id} className="border-b">
                <td className="pr-4 py-2 font-mono text-xs">{c.component_id}</td>
                <td className="pr-4 py-2">{c.label}</td>
                <td className="pr-4 py-2">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                    {c.type}
                  </span>
                </td>
                <td className="pr-4 py-2">{c.sheet_tab}</td>
                <td className="pr-4 py-2 font-mono text-xs">{c.range}</td>
                <td className="pr-4 py-2 text-slate-500">{c.depends_on || ''}</td>
                <td className="pr-4 py-2">
                  {c.props ? (
                    <pre className="text-xs bg-slate-50 p-1 rounded overflow-x-auto max-w-xs">
                      {JSON.stringify(c.props, null, 2)}
                    </pre>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

