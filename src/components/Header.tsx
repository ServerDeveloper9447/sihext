import React from 'react';
import { ShieldCheck, Settings, Sparkles, ExternalLink } from 'lucide-react';
import { RoutingMode, AIProvider } from '../types';

interface HeaderProps {
  routingMode?: RoutingMode;
  selectedProvider?: AIProvider;
  privacyActive?: boolean;
  onOpenSettings?: () => void;
  onOpenSidePanel?: () => void;
  showSidePanelButton?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  routingMode = 'auto',
  privacyActive = true,
  onOpenSettings,
  onOpenSidePanel,
  showSidePanelButton = false,
}) => {
  return (
    <header className="flex items-center justify-between px-4 py-3 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-30">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-sm font-bold bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
              AetherDOM AI
            </h1>
            <span className="text-[10px] px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 font-mono rounded border border-indigo-500/30">
              v0.1
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            Mode: <span className="text-indigo-400 capitalize">{(routingMode || 'auto').replace('-', ' ')}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Privacy shield indicator */}
        <div
          title={privacyActive ? 'Privacy Shield Active (PII & Passwords stripped)' : 'Privacy Shield Off'}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${
            privacyActive
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span className="text-[11px]">{privacyActive ? 'Shielded' : 'Raw'}</span>
        </div>

        {showSidePanelButton && onOpenSidePanel && (
          <button
            onClick={onOpenSidePanel}
            title="Open Side Panel"
            className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        )}

        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            title="Open Settings"
            className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};
