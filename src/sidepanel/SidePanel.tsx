import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  Shield,
  Play,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Cpu,
  Server,
  FileText,
  MousePointer,
  HelpCircle,
} from 'lucide-react';
import { Header } from '../components/Header';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import {
  ExtensionSettings,
  AgentMessage,
  AgentAction,
  ExtractedDOMSummary,
} from '../types';
import {
  DEFAULT_SETTINGS,
  getStoredSettings,
  getStoredChatHistory,
  saveStoredChatHistory,
} from '../utils/storage';
import { sendMessageToActiveTab, sendMessageToBackground } from '../utils/messaging';
import { AgentCoordinator } from '../ai/coordinator';

export const SidePanel: React.FC = () => {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [domSummary, setDomSummary] = useState<ExtractedDOMSummary | null>(null);
  const [activeTabUrl, setActiveTabUrl] = useState('');
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);

  const coordinatorRef = useRef(new AgentCoordinator());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load initial settings and history
  useEffect(() => {
    getStoredSettings().then(setSettings);
    getStoredChatHistory().then((history) => {
      if (history.length > 0) {
        setMessages(history);
      } else {
        // Welcome message
        setMessages([
          {
            id: 'welcome-msg',
            role: 'assistant',
            content: `👋 **Welcome to Auxilium AI Assistant!**\n\nI can analyze this webpage, answer questions, or execute actions on your behalf using **On-Device ViT** or our **Self-Hosted Model Backend**.\n\n🛡️ **Privacy Shield is Active**: Passwords, sensitive form inputs, credit cards, and faces are automatically stripped before any data leaves your browser.`,
            timestamp: Date.now(),
            modelUsed: 'AetherDOM System',
          },
        ]);
      }
    });

    refreshCurrentTabDOM();
  }, []);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (messages.length > 0) {
      saveStoredChatHistory(messages);
    }
  }, [messages]);

  const refreshCurrentTabDOM = async () => {
    try {
      const response = await sendMessageToActiveTab<undefined, ExtractedDOMSummary>({
        type: 'GET_PAGE_DOM',
      });
      if (response.success && response.data) {
        setDomSummary(response.data);
        setActiveTabUrl(response.data.url);
      }
    } catch {
      // Content script may not be injected yet
    }
  };

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: AgentMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsLoading(true);

    try {
      // 1. Get latest DOM summary
      let currentDOM = domSummary;
      const domRes = await sendMessageToActiveTab<undefined, ExtractedDOMSummary>({
        type: 'GET_PAGE_DOM',
      });
      if (domRes.success && domRes.data) {
        currentDOM = domRes.data;
        setDomSummary(currentDOM);
      }

      if (!currentDOM) {
        throw new Error('Unable to access webpage DOM. Try reloading the active tab.');
      }

      // 2. Capture screenshot if cloud execution is possible
      let screenshotUrl: string | undefined;
      try {
        const snapRes = await sendMessageToBackground<undefined, string>({
          type: 'CAPTURE_TAB',
        });
        if (snapRes.success && snapRes.data) {
          screenshotUrl = snapRes.data;
        }
      } catch {
        // Screenshot fallback
      }

      // 3. Coordinate AI Execution turn (Router -> On-device ViT / Custom Backend + Privacy Redaction)
      const { message: agentReply } = await coordinatorRef.current.executeAgentTurn(
        textToSend,
        currentDOM,
        settings,
        screenshotUrl
      );

      setMessages((prev) => [...prev, agentReply]);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ **Execution Error**: ${errorMsg}`,
          timestamp: Date.now(),
          modelUsed: 'Error Handler',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteAction = async (action: AgentAction, messageId: string) => {
    setExecutingActionId(action.id);

    try {
      const result = await sendMessageToActiveTab<AgentAction, { success: boolean; message?: string }>({
        type: 'EXECUTE_ACTION',
        payload: action,
      });

      // Update action status in message state
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === messageId && msg.actions) {
            return {
              ...msg,
              actions: msg.actions.map((a) =>
                a.id === action.id
                  ? {
                      ...a,
                      status: result.success ? 'completed' : 'failed',
                      error: result.error || (result.data && !result.data.success ? result.data.message : undefined),
                    }
                  : a
              ),
            };
          }
          return msg;
        })
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId && m.actions
            ? {
                ...m,
                actions: m.actions.map((a) =>
                  a.id === action.id ? { ...a, status: 'failed', error: msg } : a
                ),
              }
            : m
        )
      );
    } finally {
      setExecutingActionId(null);
    }
  };

  const handleExecuteAllActions = async (actions: AgentAction[], messageId: string) => {
    for (const act of actions) {
      if (act.status !== 'completed') {
        await handleExecuteAction(act, messageId);
        await new Promise((r) => setTimeout(r, settings.actionExecutionDelayMs || 300));
      }
    }
  };

  const handleHighlightElement = (refId?: string) => {
    if (!refId) return;
    sendMessageToActiveTab({
      type: 'HIGHLIGHT_ELEMENT',
      payload: { refId, label: `Target: ${refId}`, variant: 'inspect' },
    });
  };

  const handleClearHighlight = () => {
    sendMessageToActiveTab({ type: 'CLEAR_HIGHLIGHT' });
  };

  const openOptionsPage = () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open('options.html');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-sarvam-bg text-sarvam-text text-sm">
      <Header
        routingMode={settings.routingMode}
        selectedProvider={settings.selectedProvider}
        privacyActive={settings.privacy?.enabled}
        onOpenSettings={openOptionsPage}
      />

      {/* Page Context Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-sarvam-card/60 border-b border-sarvam-border/80 text-xs text-sarvam-secondary">
        <div className="flex items-center gap-2 truncate">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="truncate font-mono text-[11px] text-sarvam-text">
            {domSummary ? domSummary.title || activeTabUrl : 'Detecting active page...'}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {domSummary && (
            <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-sarvam-bg border border-sarvam-border text-sarvam-secondary font-mono">
              {domSummary.interactiveCount} nodes
            </span>
          )}
          <button
            onClick={refreshCurrentTabDOM}
            title="Refresh DOM"
            className="p-1 hover:text-white rounded-full hover:bg-white/5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Chat & Execution Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col gap-1.5 ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[11px] text-sarvam-secondary px-1">
              {msg.role === 'user' ? (
                <>
                  <span>You</span>
                  <User className="w-3 h-3 text-sarvam-indigoLight" />
                </>
              ) : (
                <>
                  <Bot className="w-3.5 h-3.5 text-sarvam-indigoLight" />
                  <span className="font-medium text-sarvam-text">{msg.modelUsed || 'AI Assistant'}</span>
                  {msg.isLocalExecution ? (
                    <Badge variant="brand" size="sm" icon={<Cpu className="w-2.5 h-2.5" />}>
                      On-Device ViT
                    </Badge>
                  ) : (
                    <Badge variant="neutral" size="sm" icon={<Server className="w-2.5 h-2.5" />}>
                      Custom Backend
                    </Badge>
                  )}
                </>
              )}
            </div>

            {/* Message Bubble with Sarvam styling */}
            <div
              className={`rounded-2xl p-3.5 max-w-[92%] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-b from-[#3a3f5c] to-[#1e2033] text-white rounded-tr-sm border border-white/10 shadow-md'
                  : 'sarvam-card text-sarvam-text rounded-tl-sm shadow-sm border border-sarvam-border'
              }`}
            >
              <div className="whitespace-pre-wrap prose prose-invert prose-xs text-[13px] leading-relaxed">
                {msg.content}
              </div>

              {/* Privacy Redaction Report */}
              {msg.redactionReport && msg.redactionReport.totalRedacted > 0 && (
                <div className="mt-3 pt-2 border-t border-sarvam-border/70 flex items-center justify-between text-[11px] text-emerald-400 bg-emerald-950/20 px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    <span>
                      Redacted {msg.redactionReport.totalRedacted} sensitive field
                      {msg.redactionReport.totalRedacted > 1 ? 's' : ''} (
                      {msg.redactionReport.redactedLabels.join(', ')})
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono tracking-wide">Shielded</span>
                </div>
              )}

              {/* Action Plan Card */}
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-3.5 pt-3 border-t border-sarvam-border/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-sm font-semibold text-sarvam-indigoLight flex items-center gap-1.5">
                      <Play className="w-3.5 h-3.5 text-sarvam-indigo" /> Action Plan ({msg.actions.length} step
                      {msg.actions.length > 1 ? 's' : ''})
                    </span>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleExecuteAllActions(msg.actions!, msg.id)}
                      disabled={msg.actions.every((a) => a.status === 'completed')}
                    >
                      Execute All
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {msg.actions.map((act) => (
                      <div
                        key={act.id}
                        onMouseEnter={() => handleHighlightElement(act.refId)}
                        onMouseLeave={handleClearHighlight}
                        className={`flex items-center justify-between p-2.5 rounded-xl text-xs border transition-colors ${
                          act.status === 'completed'
                            ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                            : act.status === 'failed'
                            ? 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                            : 'bg-sarvam-bg/90 border-sarvam-border text-sarvam-text hover:border-sarvam-indigo/50'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span className="px-2 py-0.5 rounded-full bg-[#1e2235] text-sarvam-indigoLight border border-sarvam-indigo/20 font-mono text-[10px] uppercase">
                            {act.type}
                          </span>
                          <span className="truncate">{act.description}</span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {act.status === 'completed' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : act.status === 'failed' ? (
                            <AlertTriangle className="w-4 h-4 text-rose-400" />
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              isLoading={executingActionId === act.id}
                              onClick={() => handleExecuteAction(act, msg.id)}
                            >
                              Run
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2.5 text-xs text-sarvam-indigoLight p-3 bg-sarvam-card rounded-xl border border-sarvam-indigo/20 animate-pulse">
            <Sparkles className="w-4 h-4 animate-spin-slow text-sarvam-indigo" />
            <span>Analyzing webpage DOM and formulating action response...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Action Suggestions */}
      <div className="px-3 py-2 bg-sarvam-card/40 border-t border-sarvam-border/60 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => handleSendMessage('Summarize the key information on this webpage.')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sarvam-card hover:bg-[#1a1d2c] border border-sarvam-border text-sarvam-secondary hover:text-white text-[11px] font-medium transition-all whitespace-nowrap shadow-sm"
        >
          <FileText className="w-3 h-3 text-sarvam-indigo" />
          Summarize Page
        </button>
        <button
          onClick={() => handleSendMessage('List all interactive form inputs on this page.')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sarvam-card hover:bg-[#1a1d2c] border border-sarvam-border text-sarvam-secondary hover:text-white text-[11px] font-medium transition-all whitespace-nowrap shadow-sm"
        >
          <MousePointer className="w-3 h-3 text-emerald-400" />
          Find Forms
        </button>
        <button
          onClick={() => handleSendMessage('Explain what actions can be taken on this page.')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sarvam-card hover:bg-[#1a1d2c] border border-sarvam-border text-sarvam-secondary hover:text-white text-[11px] font-medium transition-all whitespace-nowrap shadow-sm"
        >
          <HelpCircle className="w-3 h-3 text-amber-400" />
          Available Actions
        </button>
      </div>

      {/* Query Input Box */}
      <div className="p-3 bg-sarvam-card border-t border-sarvam-border relative">
        <div className="absolute inset-x-0 top-0 h-px sarvam-divider opacity-40"></div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask a question or describe an action..."
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 bg-sarvam-bg border border-sarvam-border rounded-full text-xs text-sarvam-text placeholder-sarvam-tertiary focus:outline-none focus:border-sarvam-indigo focus:ring-1 focus:ring-sarvam-indigo transition-all disabled:opacity-50"
          />
          <Button
            type="submit"
            size="md"
            variant="primary"
            disabled={!inputQuery.trim() || isLoading}
            isLoading={isLoading}
            className="rounded-full px-4"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </form>
      </div>
    </div>
  );
};
