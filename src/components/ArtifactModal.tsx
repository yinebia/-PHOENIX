import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Download, FileCode, Eye, Code2 } from 'lucide-react';
import { Artifact } from '../types/agent';

interface ArtifactModalProps {
  artifact: Artifact | null;
  onClose: () => void;
}

export const ArtifactModal: React.FC<ArtifactModalProps> = ({ artifact, onClose }) => {
  const [copied, setCopied] = useState(false);
  const isHtml =
    !!artifact &&
    (artifact.format.toLowerCase() === 'html' || artifact.name.toLowerCase().endsWith('.html'));
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');

  useEffect(() => {
    setViewMode(isHtml ? 'preview' : 'code');
  }, [artifact?.id, isHtml]);

  if (!artifact) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(artifact.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleDownload = () => {
    const mimeType = isHtml ? 'text/html' : 'text/plain';
    const blob = new Blob([artifact.content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = artifact.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={`glass-panel w-full ${isHtml && viewMode === 'preview' ? 'max-w-5xl' : 'max-w-3xl'} rounded-2xl border-purple-500/30 overflow-hidden shadow-2xl flex flex-col max-h-[88vh]`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-purple-950 border border-purple-800 text-purple-300">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-mono text-sm font-bold text-slate-100">
                {artifact.name}
              </h3>
              <div className="text-[10px] font-mono text-slate-400">
                Format: {artifact.format.toUpperCase()} • Generated at {artifact.timestamp}
                {artifact.validated ? ' • Inspected & Validated' : ''}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isHtml && (
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 mr-1">
                <button
                  onClick={() => setViewMode('preview')}
                  className={`px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer ${
                    viewMode === 'preview'
                      ? 'bg-cyan-600/30 text-cyan-200 border border-cyan-500/50'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Live Prototype</span>
                </button>
                <button
                  onClick={() => setViewMode('code')}
                  className={`px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer ${
                    viewMode === 'code'
                      ? 'bg-purple-600/30 text-purple-200 border border-purple-500/50'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Source Code</span>
                </button>
              </div>
            )}

            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-400 text-slate-200 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-purple-400 text-slate-200 text-xs font-mono transition-colors cursor-pointer"
              title="Download file"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        {isHtml && viewMode === 'preview' ? (
          <div className="flex-1 bg-white min-h-[420px] flex flex-col">
            <iframe
              title={`Prototype preview: ${artifact.name}`}
              srcDoc={artifact.content}
              sandbox="allow-scripts"
              className="w-full flex-1 min-h-[460px] border-0"
            />
          </div>
        ) : (
          <div className="p-4 overflow-y-auto flex-1 bg-[#07080E] font-mono text-xs text-slate-200">
            <pre className="whitespace-pre-wrap font-mono leading-relaxed select-text">
              {artifact.content}
            </pre>
          </div>
        )}

        {/* Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 text-[11px] font-mono text-slate-500 flex items-center justify-between">
          <span>
            {isHtml && viewMode === 'preview'
              ? 'SANDBOXED PROTOTYPE PREVIEW (ISOLATED ORIGIN)'
              : 'PHOENIX ARTIFACT VAULT // GENERATED DELIVERABLE'}
          </span>
          <span>{artifact.content.length} characters</span>
        </div>
      </div>
    </div>
  );
};
