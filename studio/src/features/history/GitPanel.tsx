import { useState } from 'react';
import HistoryTimeline from '../../../vendor/stacki/src/features/history/HistoryTimeline';
import { HistorySection } from '../../../vendor/stacki/src/features/history/HistorySections';
import { createPanelCache, usePanelData } from '../../../vendor/stacki/src/lib/usePanelData';
import { PanelReadStatus } from '../../../vendor/stacki/src/ui/PanelReadStatus';
import { record } from '../../shared/validation';
import { parseHistoryInfo, type HistoryInfo } from './historyContract';
import { request } from '../project/projectClient';
import type { SharedDocument } from '../collaboration/useDocument';

const cache = createPanelCache<HistoryInfo>();
const subscribe = () => () => {};
const noPreview = () => {};

export function GitPanel({
  document,
  report,
}: {
  readonly document: SharedDocument | undefined;
  readonly report: (error: unknown) => void;
}) {
  const [open, setOpen] = useState(true);
  const { state, refresh } = usePanelData(cache, 'studio', readHistoryInfo, subscribe);
  return (
    <div className="panel-section grow">
      <div className="panel-header">
        <h2>Git</h2>
      </div>
      <div className="panel-body history-body">
        <div className="node-actions">
          <button
            disabled={!document?.ready}
            onClick={() => void document?.history.step('undo').catch(report)}
          >
            Undo
          </button>
          <button
            disabled={!document?.ready}
            onClick={() => void document?.history.step('redo').catch(report)}
          >
            Redo
          </button>
        </div>
        <PanelReadStatus state={state} label="Git history" retry={refresh} />
        {state.kind === 'ready' && (
          <HistorySection title="Source Control Graph" open={open} onToggle={() => setOpen(!open)}>
            <HistoryTimeline
              projectPath="studio"
              branch={state.value.branch}
              branches={state.value.branches}
              trunk={state.value.branch}
              head={state.value.head}
              userEmail={undefined}
              previewRef={undefined}
              onExitPreview={noPreview}
            />
          </HistorySection>
        )}
      </div>
    </div>
  );
}

async function readHistoryInfo() {
  try {
    const response = record(await request('/studio/api/history/log?skip=0&scope=all'));
    return { ok: true, value: parseHistoryInfo(response['info']) } as const;
  } catch (error: unknown) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not read Git.',
    } as const;
  }
}
