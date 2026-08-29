import React, { useState, useEffect } from 'react';
import {
  Shield,
  Server,
  Cpu,
  Save,
  Check,
  Sparkles,
  Lock,
  Plus,
  Trash2,
  Sliders,
  Activity,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Toggle } from '../components/Toggle';
import { ExtensionSettings, RoutingMode } from '../types';
import { DEFAULT_SETTINGS, getStoredSettings, saveStoredSettings } from '../utils/storage';
import { CustomBackendClient } from '../ai/backend/custom-backend-client';

export const Options: React.FC = () => {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<'backend' | 'privacy' | 'routing' | 'safety'>('backend');
  const [isSaved, setIsSaved] = useState(false);
  const [customRegexInput, setCustomRegexInput] = useState('');
  
  // Connection Test State
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; latencyMs?: number } | null>(null);

  useEffect(() => {
    getStoredSettings().then(setSettings);
  }, []);

  const handleSave = async () => {
    await saveStoredSettings(settings);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleTestBackend = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const client = new CustomBackendClient(settings.backend);
      const res = await client.testConnection();
      setTestResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestResult({ ok: false, message: `Ping failed: ${msg}` });
    } finally {
      setIsTesting(false);
    }
  };

  const handleAddRegexRule = () => {
    if (!customRegexInput.trim()) return;
    try {
      new RegExp(customRegexInput); // Validate regex
      setSettings((prev) => ({
        ...prev,
        privacy: {
          ...prev.privacy,
          customRegexRules: [...prev.privacy.customRegexRules, customRegexInput.trim()],
        },
      }));
      setCustomRegexInput('');
    } catch {
      alert('Invalid regular expression pattern.');
    }
  };

  const handleRemoveRegexRule = (index: number) => {
    setSettings((prev) => ({
      ...prev,
      privacy: {
        ...prev.privacy,
        customRegexRules: prev.privacy.customRegexRules.filter((_, i) => i !== index),
      },
    }));
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-6 text-slate-100">
      {/* Top Banner */}
      <div className="flex items-center justify-between pb-8 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">AetherDOM AI Settings</h1>
            <p className="text-xs text-slate-400">
              Custom Self-Hosted Model Backend & Privacy Redaction Configuration
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={handleSave}
          leftIcon={isSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          className={isSaved ? 'bg-emerald-600 hover:bg-emerald-500' : ''}
        >
          {isSaved ? 'Saved Settings!' : 'Save Changes'}
        </Button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-2 pt-6 pb-6 border-b border-slate-800/80">
        <button
          onClick={() => setActiveTab('backend')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'backend'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Server className="w-4 h-4" /> Self-Hosted Model Backend
        </button>

        <button
          onClick={() => setActiveTab('privacy')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'privacy'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Shield className="w-4 h-4" /> Privacy & Redaction Shield
        </button>

        <button
          onClick={() => setActiveTab('routing')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'routing'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Cpu className="w-4 h-4" /> Hybrid Routing Policy
        </button>

        <button
          onClick={() => setActiveTab('safety')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'safety'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Sliders className="w-4 h-4" /> Automation Safety
        </button>
      </div>

      {/* Tab Content */}
      <div className="py-6 space-y-6">
        {/* TAB 1: SELF-HOSTED MODEL BACKEND */}
        {activeTab === 'backend' && (
          <div className="space-y-6">
            <Card className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <Server className="w-4 h-4 text-indigo-400" /> Model Server Endpoint
                  </h2>
                  <p className="text-xs text-slate-400">
                    Connects directly to your own self-hosted vision/LLM agent backend. Zero corporate cloud APIs.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestBackend}
                  isLoading={isTesting}
                  leftIcon={<Activity className="w-3.5 h-3.5" />}
                >
                  Test Connection
                </Button>
              </div>

              {testResult && (
                <div
                  className={`p-3 rounded-lg flex items-center gap-2 text-xs border ${
                    testResult.ok
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                  }`}
                >
                  {testResult.ok ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}

              {/* Endpoint URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Backend API Endpoint URL <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={settings.backend?.endpointUrl || ''}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      backend: { ...prev.backend, endpointUrl: e.target.value },
                    }))
                  }
                  placeholder="http://localhost:8000/api/v1/agent"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono text-xs"
                />
                <p className="text-[11px] text-slate-400">
                  The HTTP(S) URL of your model backend service (supports JSON DOM action requests).
                </p>
              </div>

              {/* Model Identifier */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Model Name / Identifier</label>
                <input
                  type="text"
                  value={settings.backend?.modelName || ''}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      backend: { ...prev.backend, modelName: e.target.value },
                    }))
                  }
                  placeholder="custom-dom-agent-v1"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* API Token / Secret */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Authorization Bearer Token / Secret <span className="text-slate-500">(Optional)</span>
                </label>
                <input
                  type="password"
                  value={settings.backend?.apiKey || ''}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      backend: { ...prev.backend, apiKey: e.target.value },
                    }))
                  }
                  placeholder="Bearer your-custom-secret-key"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Timeout */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Request Timeout (seconds)</label>
                <input
                  type="number"
                  min="5"
                  max="180"
                  value={Math.round((settings.backend?.timeoutMs || 30000) / 1000)}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      backend: {
                        ...prev.backend,
                        timeoutMs: Math.max(5, parseInt(e.target.value) || 30) * 1000,
                      },
                    }))
                  }
                  className="w-32 px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </Card>
          </div>
        )}

        {/* TAB 2: PRIVACY & REDACTION SHIELD */}
        {activeTab === 'privacy' && (
          <div className="space-y-6">
            <Card className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400" /> Pre-Flight Privacy Redactor
                  </h2>
                  <p className="text-xs text-slate-400">
                    Automatically scrubs confidential elements and visual areas before passing data to the backend.
                  </p>
                </div>
                <Toggle
                  checked={settings.privacy.enabled}
                  onChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      privacy: { ...prev.privacy, enabled: checked },
                    }))
                  }
                />
              </div>

              <div className="space-y-3.5 pt-2">
                <Toggle
                  checked={settings.privacy.maskPasswords}
                  onChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      privacy: { ...prev.privacy, maskPasswords: checked },
                    }))
                  }
                  label="Mask Password Inputs & Secret Credentials"
                  description="Replaces password field values and credentials with [REDACTED_PASSWORD]"
                />

                <Toggle
                  checked={settings.privacy.maskCreditCards}
                  onChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      privacy: { ...prev.privacy, maskCreditCards: checked },
                    }))
                  }
                  label="Strip Credit Card Numbers & CVVs"
                  description="Detects 13-19 digit card patterns and replaces with [REDACTED_CREDIT_CARD]"
                />

                <Toggle
                  checked={settings.privacy.maskEmails}
                  onChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      privacy: { ...prev.privacy, maskEmails: checked },
                    }))
                  }
                  label="Redact Email Addresses"
                  description="Replaces emails with [REDACTED_EMAIL]"
                />

                <Toggle
                  checked={settings.privacy.maskPhoneNumbers}
                  onChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      privacy: { ...prev.privacy, maskPhoneNumbers: checked },
                    }))
                  }
                  label="Redact Phone Numbers"
                  description="Replaces phone numbers with [REDACTED_PHONE]"
                />

                <Toggle
                  checked={settings.privacy.maskFaces}
                  onChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      privacy: { ...prev.privacy, maskFaces: checked },
                    }))
                  }
                  label="Blur & Mask Human Faces on Screenshots"
                  description="Pixelates and draws blackout blocks over detected face bounding boxes on captured tab screenshots"
                />
              </div>
            </Card>

            {/* Custom Regex Rules */}
            <Card className="space-y-4">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-400" /> Custom Regex Redaction Blacklist
              </h2>
              <p className="text-xs text-slate-400">
                Add custom regex patterns to automatically scrub proprietary data (e.g. employee IDs, internal tokens).
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={customRegexInput}
                  onChange={(e) => setCustomRegexInput(e.target.value)}
                  placeholder="e.g. EMP-\\d{6} or [A-Z]{3}-\\d{4}"
                  className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
                <Button variant="secondary" size="md" onClick={handleAddRegexRule} leftIcon={<Plus className="w-4 h-4" />}>
                  Add Rule
                </Button>
              </div>

              {settings.privacy.customRegexRules.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  {settings.privacy.customRegexRules.map((rule, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono"
                    >
                      <span className="text-indigo-300">{rule}</span>
                      <button
                        onClick={() => handleRemoveRegexRule(idx)}
                        className="text-slate-500 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* TAB 3: ROUTING POLICY */}
        {activeTab === 'routing' && (
          <div className="space-y-6">
            <Card className="space-y-4">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-400" /> Hybrid AI Routing Strategy
              </h2>
              <p className="text-xs text-slate-400">
                Choose how requests are balanced between local on-device ViT and your self-hosted model backend.
              </p>

              <div className="space-y-3">
                {[
                  {
                    mode: 'auto',
                    title: 'Auto Balanced (Recommended)',
                    desc: 'Uses on-device ViT for sensitive forms and fast DOM actions; routes multi-step reasoning to your custom backend.',
                  },
                  {
                    mode: 'on-device-preferred',
                    title: 'On-Device Preferred',
                    desc: 'Prefers on-device ViT / WebGPU; falls back to custom backend only when on-device confidence is low.',
                  },
                  {
                    mode: 'on-device-only',
                    title: 'On-Device Strict (100% In-Browser)',
                    desc: 'Never sends any data to the backend. Runs purely in-browser.',
                  },
                  {
                    mode: 'backend-preferred',
                    title: 'Backend Preferred',
                    desc: 'Prefers your self-hosted model backend with pre-flight PII redaction.',
                  },
                  {
                    mode: 'backend-only',
                    title: 'Backend Only',
                    desc: 'Routes all requests directly to your custom model backend.',
                  },
                ].map((item) => (
                  <label
                    key={item.mode}
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        routingMode: item.mode as RoutingMode,
                      }))
                    }
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      settings.routingMode === item.mode
                        ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10'
                        : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="routingMode"
                      checked={settings.routingMode === item.mode}
                      onChange={() => {}}
                      className="mt-1 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="font-semibold text-sm text-white block">{item.title}</span>
                      <span className="text-xs text-slate-400">{item.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* TAB 4: AUTOMATION SAFETY */}
        {activeTab === 'safety' && (
          <div className="space-y-6">
            <Card className="space-y-4">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" /> Automation Safeguards
              </h2>

              <div className="space-y-3.5">
                <Toggle
                  checked={settings.autoConfirmSafeActions}
                  onChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      autoConfirmSafeActions: checked,
                    }))
                  }
                  label="Auto-Confirm Safe Actions"
                  description="Allows harmless actions (scroll, navigation, reading) to execute automatically while requiring approval for form submissions"
                />

                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-200">
                      Action Execution Step Delay
                    </label>
                    <span className="text-xs font-mono text-indigo-400">
                      {settings.actionExecutionDelayMs} ms
                    </span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="1500"
                    step="50"
                    value={settings.actionExecutionDelayMs}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        actionExecutionDelayMs: parseInt(e.target.value),
                      }))
                    }
                    className="w-full accent-indigo-600"
                  />
                  <p className="text-xs text-slate-400">
                    Adds a visual delay between sequential DOM actions for smooth human supervision.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};
