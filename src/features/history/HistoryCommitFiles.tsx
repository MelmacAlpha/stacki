import { useState } from 'react';
import type { HistoryCommit, HistoryCommitFile } from './historyBridge';
import { summarizeHistoryFiles } from './historyFileSummary';
import HistoryFilesDialog from './HistoryFilesDialog';
import { ChevronRightIcon } from '../../ui/Icons';

export default function HistoryCommitFiles({
  commit,
  projectPath,
  onRestoreFile,
}: {
  readonly commit: HistoryCommit;
  readonly projectPath: string;
  readonly onRestoreFile?: ((commit: HistoryCommit, file: HistoryCommitFile) => void) | undefined;
}) {
  const [open, setOpen] = useState(false);
  const files = commit.files;
  if (files === undefined) {
    return <p className="history-note">Changed files are unavailable.</p>;
  }
  if (files.length === 0) {
    return <p className="history-note">No files changed.</p>;
  }
  const counts = summarizeHistoryFiles(files);
  return (
    <>
      <button
        className="history-view-files"
        aria-label={`View changed files (${files.length})`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <span className="history-file-summary">
          <span className="history-count-added" title={`${counts.added} files added`}>
            +{counts.added}
          </span>
          <span className="history-count-deleted" title={`${counts.deleted} files deleted`}>
            −{counts.deleted}
          </span>
          <span className="history-count-updated" title={`${counts.updated} files updated`}>
            ~{counts.updated}
          </span>
        </span>
        <span className="history-view-files-label">
          {files.length} {files.length === 1 ? 'file' : 'files'} <ChevronRightIcon size={12} />
        </span>
      </button>
      {open && (
        <HistoryFilesDialog
          commit={commit}
          projectPath={projectPath}
          files={files}
          onClose={() => setOpen(false)}
          onRestoreFile={onRestoreFile}
        />
      )}
    </>
  );
}
