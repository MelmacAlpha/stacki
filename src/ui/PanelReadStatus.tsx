import React from 'react';
import type { PanelData } from '../lib/usePanelData';

export function PanelReadStatus({
  state,
  label,
  retry,
}: {
  readonly state: PanelData<unknown>;
  readonly label: string;
  readonly retry: () => Promise<void>;
}) {
  if (state.kind === 'loading') {
    return (
      <div className="panel-loading" role="status">
        <span className="panel-loading-label">Loading {label}…</span>
        <div className="panel-loading-rows" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  }
  if (state.kind === 'error') {
    return (
      <div className="props-empty" role="alert">
        <p>{state.message}</p>
        <button className="ghost" onClick={() => void retry()}>
          Retry
        </button>
      </div>
    );
  }
  return undefined;
}
