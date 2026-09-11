import React from 'react';
import { ShieldCheck, Settings, ExternalLink } from 'lucide-react';
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
    <header className="relative bg-sarvam-bg/95 backdrop-blur-md border-b border-sarvam-border/80 sticky top-0 z-30">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          {/* Sovereign geometric gateway logo */}
          <div className="w-8 h-8 rounded-xl bg-gradient-to-b from-[#3a3f5c] to-[#1e2033] border border-white/10 flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_6px_rgba(0,0,0,0.4)]">
            <svg
              className="w-4 h-4 text-sarvam-indigoLight"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-base tracking-tight font-medium text-white">
                Auxilium AI
              </h1>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[#1e2235] text-sarvam-indigoLight border border-sarvam-indigo/20">
                v1.0
              </span>
            </div>
            <p className="text-[10.5px] text-sarvam-secondary tracking-wide">
              Mode: <span className="text-sarvam-indigoLight capitalize">{(routingMode || 'auto').replace('-', ' ')}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Privacy shield indicator */}
          <div
            title={privacyActive ? 'Privacy Shield Active (PII & Passwords stripped)' : 'Privacy Shield Off'}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
              privacyActive
                ? 'bg-emerald-950/30 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
                : 'bg-[#181b28] text-sarvam-secondary border-sarvam-border'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="text-[10.5px]">{privacyActive ? 'Protected' : 'Raw'}</span>
          </div>

          {showSidePanelButton && onOpenSidePanel && (
            <button
              onClick={onOpenSidePanel}
              title="Open Side Panel"
              className="p-1.5 text-sarvam-secondary hover:text-white hover:bg-sarvam-card rounded-full border border-transparent hover:border-sarvam-border transition-all"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}

          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              title="Open Settings"
              className="p-1.5 text-sarvam-secondary hover:text-white hover:bg-sarvam-card rounded-full border border-transparent hover:border-sarvam-border transition-all"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      {/* Subtle bottom radial gradient line like Sarvam */}
      <div className="absolute inset-x-0 bottom-0 h-px sarvam-divider opacity-60"></div>
    </header>
  );
};
