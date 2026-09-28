import React, { useState, useEffect } from 'react';
import {
  Shield,
  Server,
  Cpu,
  Save,
  Check,
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
    <div className="min-h-screen bg-sarvam-bg text-sarvam-text selection:bg-sarvam-indigo/30 selection:text-white">
      <div className="max-w-4xl mx-auto py-12 px-6">
        {/* Top Banner with Sarvam Aesthetic */}
        <div className="relative flex items-center justify-between pb-8 border-b border-sarvam-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-[#3a3f5c] to-[#1e2033] border border-white/10 flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_4px_12px_rgba(0,0,0,0.5)]">
              <svg
                className="w-6 h-6 text-sarvam-indigoLight"
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
              <div className="flex items-center gap-2.5">
                <h1 className="font-serif text-2xl font-medium tracking-wide text-white">
                  Auxilium AI Settings
                </h1>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#1e2235] text-sarvam-indigoLight border border-sarvam-indigo/25">
                  Sovereign Agent
                </span>
              </div>
              <p className="text-xs text-sarvam-secondary mt-1 tracking-wide">
                Configure your Self-Hosted Model Backend & Privacy-Preserving Redaction Rules
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={handleSave}
            leftIcon={isSaved ? <Check className="w-4 h-4 text-emerald-300" /> : <Save className="w-4 h-4" />}
            className={isSaved ? 'from-emerald-700 to-emerald-900 border-emerald-500/40 text-emerald-100' : ''}
          >
            <span className="font-serif text-[14px]">{isSaved ? 'Settings Saved' : 'Save Changes'}</span>
          </Button>

          <div className="absolute inset-x-0 bottom-0 h-px sarvam-divider opacity-70"></div>
        </div>

        {/* Pill Tabs Navigation like Sarvam Website */}
        <div className="flex gap-2 pt-6 pb-6 overflow-x-auto no-scrollbar">
          {[
            { id: 'backend', label: 'Self-Hosted Backend', icon: <Server className="w-4 h-4" /> },
            { id: 'privacy', label: 'Privacy & Redaction', icon: <Shield className="w-4 h-4" /> },
            { id: 'routing', label: 'Hybrid Routing', icon: <Cpu className="w-4 h-4" /> },
            { id: 'safety', label: 'Automation Safety', icon: <Sliders className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium tracking-wide transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-b from-[#3a3f5c] to-[#1e2033] text-white border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_2px_8px_rgba(0,0,0,0.35)]'
                  : 'bg-sarvam-card/60 text-sarvam-secondary hover:text-sarvam-text hover:bg-sarvam-card border border-sarvam-border/60'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="py-2 space-y-6">
          {/* TAB 1: SELF-HOSTED MODEL BACKEND */}
          {activeTab === 'backend' && (
            <div className="space-y-6">
              <Card className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-sarvam-border">
                  <div>
                    <h2 className="font-serif text-lg font-medium text-white flex items-center gap-2">
                      <Server className="w-4 h-4 text-sarvam-indigo" /> Model Server Endpoint
                    </h2>
                    <p className="text-xs text-sarvam-secondary mt-0.5">
                      Connects directly to your private self-hosted vision/LLM agent backend. Zero external corporate APIs.
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
                    className={`p-3 rounded-xl flex items-center gap-2.5 text-xs border transition-all ${
                      testResult.ok
                        ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
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
                  <label className="text-xs font-semibold text-sarvam-text">
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
                    className="w-full px-4 py-2.5 bg-sarvam-bg border border-sarvam-border rounded-xl text-xs text-sarvam-text placeholder-sarvam-tertiary focus:outline-none focus:border-sarvam-indigo font-mono"
                  />
                  <p className="text-[11px] text-sarvam-secondary">
                    The HTTP(S) URL of your model backend service (supports JSON DOM action requests).
                  </p>
                </div>

                {/* Model Identifier */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-sarvam-text">Model Name / Identifier</label>
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
                    className="w-full px-4 py-2.5 bg-sarvam-bg border border-sarvam-border rounded-xl text-xs text-sarvam-text placeholder-sarvam-tertiary focus:outline-none focus:border-sarvam-indigo"
                  />
                </div>

                {/* API Token / Secret */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-sarvam-text">
                    Authorization Bearer Token / Secret <span className="text-sarvam-tertiary font-normal">(Optional)</span>
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
                    className="w-full px-4 py-2.5 bg-sarvam-bg border border-sarvam-border rounded-xl text-xs text-sarvam-text placeholder-sarvam-tertiary focus:outline-none focus:border-sarvam-indigo"
                  />
                </div>

                {/* Timeout */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-sarvam-text">Request Timeout (seconds)</label>
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
                    className="w-36 px-4 py-2 bg-sarvam-bg border border-sarvam-border rounded-xl text-xs text-sarvam-text focus:outline-none focus:border-sarvam-indigo"
                  />
                </div>
              </Card>
            </div>
          )}

          {/* TAB 2: PRIVACY & REDACTION SHIELD */}
          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <Card className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-sarvam-border">
                  <div>
                    <h2 className="font-serif text-lg font-medium text-white flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-400" /> Pre-Flight Privacy Redactor
                    </h2>
                    <p className="text-xs text-sarvam-secondary mt-0.5">
                      Automatically scrubs confidential elements and visual areas before passing data to the backend.
                    </p>
                  </div>
                  <Toggle
                    checked={settings.privacy?.enabled}
                    onChange={(checked) =>
                      setSettings((prev) => ({
                        ...prev,
                        privacy: { ...prev.privacy, enabled: checked },
                      }))
                    }
                  />
                </div>

                <div className="space-y-4 pt-1">
                  <Toggle
                    checked={settings.privacy?.maskPasswords}
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
                    checked={settings.privacy?.maskCreditCards}
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
                    checked={settings.privacy?.maskEmails}
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
                    checked={settings.privacy?.maskPhoneNumbers}
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
                    checked={false}
                    onChange={() => undefined}
                    disabled
                    label="Face Redaction (Unavailable)"
                    description="Face detection is not implemented; screenshot redaction currently covers recognized sensitive DOM fields."
                  />
                </div>
              </Card>

              {/* Custom Regex Rules */}
              <Card className="space-y-4">
                <h2 className="font-serif text-lg font-medium text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-sarvam-indigo" /> Custom Regex Redaction Blacklist
                </h2>
                <p className="text-xs text-sarvam-secondary">
                  Add custom regex patterns to automatically scrub proprietary data (e.g. employee IDs, internal tokens).
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customRegexInput}
                    onChange={(e) => setCustomRegexInput(e.target.value)}
                    placeholder="e.g. EMP-\\d{6} or [A-Z]{3}-\\d{4}"
                    className="flex-1 px-4 py-2 bg-sarvam-bg border border-sarvam-border rounded-xl text-xs font-mono text-sarvam-text placeholder-sarvam-tertiary focus:outline-none focus:border-sarvam-indigo"
                  />
                  <Button variant="secondary" size="md" onClick={handleAddRegexRule} leftIcon={<Plus className="w-4 h-4" />}>
                    Add Rule
                  </Button>
                </div>

                {settings.privacy?.customRegexRules && settings.privacy.customRegexRules.length > 0 && (
                  <div className="space-y-2 pt-2">
                    {settings.privacy.customRegexRules.map((rule, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 bg-sarvam-bg rounded-xl border border-sarvam-border text-xs font-mono"
                      >
                        <span className="text-sarvam-indigoLight">{rule}</span>
                        <button
                          onClick={() => handleRemoveRegexRule(idx)}
                          className="text-sarvam-tertiary hover:text-rose-400 p-1 transition-colors"
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
                <h2 className="font-serif text-lg font-medium text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-sarvam-indigo" /> Hybrid AI Routing Strategy
                </h2>
                <p className="text-xs text-sarvam-secondary">
                  Choose how requests are balanced between on-device YOLO and your self-hosted model backend.
                </p>

                <div className="space-y-3">
                  {[
                    {
                      mode: 'auto',
                      title: 'Auto Balanced (Recommended)',
                      desc: 'Uses on-device YOLO for straightforward actions; routes complex reasoning to your custom backend.',
                    },
                    {
                      mode: 'on-device-preferred',
                      title: 'On-Device Preferred',
                      desc: 'Prefers on-device YOLO for webpage actions.',
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
                      className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        settings.routingMode === item.mode
                          ? 'border-sarvam-indigo/50 bg-[#171b2b] shadow-sm'
                          : 'border-sarvam-border bg-sarvam-bg/40 hover:border-sarvam-borderHover'
                      }`}
                    >
                      <input
                        type="radio"
                        name="routingMode"
                        checked={settings.routingMode === item.mode}
                        onChange={() => {}}
                        className="mt-1 text-sarvam-indigo focus:ring-sarvam-indigo"
                      />
                      <div>
                        <span className="font-serif font-medium text-sm text-white block">{item.title}</span>
                        <span className="text-xs text-sarvam-secondary">{item.desc}</span>
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
                <h2 className="font-serif text-lg font-medium text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-sarvam-indigo" /> Automation Safeguards
                </h2>

                <div className="space-y-4">
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

                  <div className="space-y-2 pt-2 border-t border-sarvam-border">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-sarvam-text">
                        Action Execution Step Delay
                      </label>
                      <span className="text-xs font-mono text-sarvam-indigoLight">
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
                      className="w-full accent-sarvam-indigo"
                    />
                    <p className="text-[11px] text-sarvam-secondary">
                      Adds a visual delay between sequential DOM actions for smooth human supervision.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
