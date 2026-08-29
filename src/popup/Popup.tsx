import React, { useState, useEffect } from 'react';
import {
  Sparkles,
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
    <div className="w-[360px] bg-slate-950 text-slate-100 text-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h1 className="text-xs font-bold text-white">AetherDOM AI</h1>
            <span className="text-[10px] text-slate-400">Hybrid Vision & DOM Agent</span>
          </div>
        </div>

        <button
          onClick={openOptions}
          title="Settings"
          className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-md transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3.5">
        {/* Main CTA: Open Full Agent SidePanel */}
        <Button
          variant="primary"
          size="md"
          className="w-full justify-between shadow-indigo-600/30"
          onClick={openSidePanel}
          rightIcon={<ExternalLink className="w-4 h-4" />}
        >
          <span>Open Agent Workspace</span>
        </Button>

        {/* Active Page Snapshot Card */}
        <Card className="space-y-2.5 bg-slate-900/60 border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="font-semibold flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" /> Active Webpage
            </span>
            <button
              onClick={fetchPageInfo}
              disabled={isLoading}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <p className="text-xs text-slate-400 truncate font-mono bg-slate-950 px-2 py-1 rounded border border-slate-800/80">
            {domSummary ? domSummary.title || domSummary.url : 'No active page scanned'}
          </p>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 block">Interactive Elements</span>
              <span className="text-sm font-bold text-indigo-400">
                {domSummary ? domSummary.interactiveCount : '--'}
              </span>
            </div>
            <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 block">Sensitive Fields</span>
              <span className="text-sm font-bold text-emerald-400">
                {domSummary ? domSummary.sensitiveElementsCount : '--'}
              </span>
            </div>
          </div>
        </Card>

        {/* Privacy Shield Status */}
        <Card className="space-y-2 bg-slate-900/40 border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`p-1.5 rounded-lg ${
                  settings?.privacy?.enabled
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-200 block">Privacy Shield</span>
                <span className="text-[10px] text-slate-400">
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

        {/* Model Routing Info */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              Engine: <strong className="text-slate-200 capitalize">{(settings?.routingMode || 'auto').replace('-', ' ')}</strong>
            </span>
          </div>
          <Badge variant="brand" size="sm">
            {settings?.selectedProvider === 'local-vit' ? 'ON-DEVICE' : 'CUSTOM BACKEND'}
          </Badge>
        </div>
      </div>
    </div>
  );
};
