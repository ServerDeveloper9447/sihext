import React, { useState, useEffect } from 'react';
import {
  Shield,
  ExternalLink,
  Settings,
  Cpu,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Toggle } from '../components/Toggle';
import { ExtensionSettings, ExtractedDOMSummary } from '../types';
import { DEFAULT_SETTINGS, getStoredSettings, saveStoredSettings } from '../utils/storage';
import { sendMessageToActiveTab, sendMessageToBackground } from '../utils/messaging';

export const Popup: React.FC = () => {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [domSummary, setDomSummary] = useState<ExtractedDOMSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    getStoredSettings().then(setSettings);
    fetchPageInfo();
  }, []);

  const fetchPageInfo = async () => {
    setIsLoading(true);
    try {
      const res = await sendMessageToActiveTab<undefined, ExtractedDOMSummary>({
        type: 'GET_PAGE_DOM',
      });
      if (res.success && res.data) {
        setDomSummary(res.data);
      }
    } catch {
      // Content script may not be available on chrome:// pages
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePrivacy = async (enabled: boolean) => {
    const updated = {
      ...settings,
      privacy: {
        ...settings.privacy,
        enabled,
      },
    };
    setSettings(updated);
    await saveStoredSettings(updated);
  };

  const openSidePanel = async () => {
    // Request background to open sidepanel for current window
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id && tab.windowId && chrome.sidePanel) {
      chrome.sidePanel.open({ windowId: tab.windowId });
      window.close();
    } else {
      sendMessageToBackground({ type: 'OPEN_SIDE_PANEL' });
      window.close();
    }
  };

  const openOptions = () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open('options.html');
    }
  };

  return (
    <div className="w-[360px] bg-sarvam-bg text-sarvam-text text-sm flex flex-col min-h-[480px]">
      {/* Header with Sarvam Styling */}
      <div className="relative flex items-center justify-between px-4 py-3 bg-sarvam-card/90 border-b border-sarvam-border/80">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-b from-[#3a3f5c] to-[#1e2033] border border-white/10 flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_6px_rgba(0,0,0,0.3)]">
            <svg
              className="w-3.5 h-3.5 text-sarvam-indigoLight"
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
            <h1 className="font-serif text-base tracking-tight font-medium text-white leading-none">
              Auxilium AI
            </h1>
            <span className="text-[10px] text-sarvam-secondary tracking-wide block mt-0.5">
              Hybrid Vision & DOM Agent
            </span>
          </div>
        </div>

        <button
          onClick={openOptions}
          title="Settings"
          className="p-1.5 text-sarvam-secondary hover:text-white hover:bg-[#1a1d2d] rounded-full border border-transparent hover:border-sarvam-border transition-all"
        >
          <Settings className="w-4 h-4" />
        </button>
        <div className="absolute inset-x-0 bottom-0 h-px sarvam-divider opacity-50"></div>
      </div>

      <div className="p-4 space-y-3.5 flex-1 flex flex-col justify-between">
        <div className="space-y-3.5">
          {/* Main CTA: Open Full Agent SidePanel */}
          <Button
            variant="primary"
            size="md"
            className="w-full justify-between py-2.5"
            onClick={openSidePanel}
            rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
          >
            <span className="font-serif text-[13.5px] tracking-wide">Open Agent Workspace</span>
          </Button>

          {/* Active Page Snapshot Card */}
          <Card className="space-y-2.5 bg-sarvam-card border-sarvam-border/90">
            <div className="flex items-center justify-between text-xs text-sarvam-text">
              <span className="font-medium flex items-center gap-1.5 text-sarvam-indigoLight">
                <Layers className="w-3.5 h-3.5" /> Active Webpage
              </span>
              <button
                onClick={fetchPageInfo}
                disabled={isLoading}
                title="Refresh Page Scan"
                className="text-sarvam-secondary hover:text-white p-1 rounded-full hover:bg-white/5 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <p className="text-[11px] text-sarvam-secondary truncate font-mono bg-sarvam-bg/90 px-2.5 py-1.5 rounded-lg border border-sarvam-border/60">
              {domSummary ? domSummary.title || domSummary.url : 'No active page scanned'}
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="bg-sarvam-bg/70 p-2.5 rounded-xl border border-sarvam-border/70 text-center">
                <span className="text-[10px] text-sarvam-tertiary block font-medium uppercase tracking-wider">
                  Interactive Nodes
                </span>
                <span className="text-sm font-serif font-bold text-sarvam-indigoLight">
                  {domSummary ? domSummary.interactiveCount : '--'}
                </span>
              </div>
              <div className="bg-sarvam-bg/70 p-2.5 rounded-xl border border-sarvam-border/70 text-center">
                <span className="text-[10px] text-sarvam-tertiary block font-medium uppercase tracking-wider">
                  Sensitive Fields
                </span>
                <span className="text-sm font-serif font-bold text-emerald-400">
                  {domSummary ? domSummary.sensitiveElementsCount : '--'}
                </span>
              </div>
            </div>
          </Card>

          {/* Privacy Shield Status */}
          <Card className="space-y-2 bg-sarvam-card border-sarvam-border/90">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2 rounded-xl border ${
                    settings?.privacy?.enabled
                      ? 'bg-emerald-950/30 text-emerald-400 border-emerald-500/30'
                      : 'bg-[#181b28] text-sarvam-secondary border-sarvam-border'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-sarvam-text block">Privacy Shield</span>
                  <span className="text-[10.5px] text-sarvam-secondary">
                    {settings?.privacy?.enabled
                      ? 'PII & Passwords auto-stripped'
                      : 'Unprotected mode'}
                  </span>
                </div>
              </div>

              <Toggle
                checked={!!settings?.privacy?.enabled}
                onChange={handleTogglePrivacy}
              />
            </div>
          </Card>
        </div>

        {/* Model Routing Info */}
        <div className="flex items-center justify-between text-[11px] text-sarvam-secondary px-1 pt-2 border-t border-sarvam-border/50">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-sarvam-indigo" />
            <span>
              Engine: <strong className="text-sarvam-text capitalize">{(settings?.routingMode || 'auto').replace('-', ' ')}</strong>
            </span>
          </div>
          <Badge variant="brand" size="sm">
            {settings?.selectedProvider === 'local-vit' ? 'ON-DEVICE ViT' : 'CUSTOM BACKEND'}
          </Badge>
        </div>
      </div>
    </div>
  );
};
