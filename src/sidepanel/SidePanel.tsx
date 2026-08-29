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
  Cloud,
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
import { AgentCoordinator } from '../ai/cloud/provider';

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
            content: `👋 **Welcome to AetherDOM AI Assistant!**\n\nI can analyze this webpage, answer questions, or execute actions on your behalf using **On-Device ViT** or **Cloud AI models**.\n\n🛡️ **Privacy Shield is Active**: Passwords, sensitive form inputs, credit cards, and faces are automatically stripped before any data leaves your browser.`,
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

      // 3. Coordinate AI Execution turn (Router -> On-device ViT / Cloud + Privacy Redaction)
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
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 text-sm">
      <Header
        routingMode={settings.routingMode}
        selectedProvider={settings.selectedProvider}
        privacyActive={settings.privacy.enabled}
        onOpenSettings={openOptionsPage}
      />

      {/* Page Context Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/50 border-b border-slate-800 text-xs text-slate-400">
        <div className="flex items-center gap-1.5 truncate">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="truncate font-mono text-[11px]">
            {domSummary ? domSummary.title || activeTabUrl : 'Detecting active page...'}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {domSummary && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
              {domSummary.interactiveCount} nodes
            </span>
          )}
          <button
            onClick={refreshCurrentTabDOM}
            title="Refresh DOM"
            className="hover:text-indigo-400 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Chat & Execution Stream */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col gap-1.5 ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 px-1">
              {msg.role === 'user' ? (
                <>
                  <span>You</span>
                  <User className="w-3 h-3 text-indigo-400" />
                </>
              ) : (
                <>
                  <Bot className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="font-medium text-slate-300">{msg.modelUsed || 'AI Assistant'}</span>
                  {msg.isLocalExecution ? (
                    <Badge variant="brand" size="sm" icon={<Cpu className="w-2.5 h-2.5" />}>
                      On-Device ViT
                    </Badge>
                  ) : (
                    <Badge variant="neutral" size="sm" icon={<Cloud className="w-2.5 h-2.5" />}>
                      Cloud AI
                    </Badge>
                  )}
                </>
              )}
            </div>

            {/* Message Bubble */}
            <div
              className={`rounded-2xl p-3 max-w-[92%] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-sm shadow-md'
                  : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-sm shadow-sm'
              }`}
            >
              <div className="whitespace-pre-wrap prose prose-invert prose-xs">
                {msg.content}
              </div>

              {/* Privacy Redaction Report */}
              {msg.redactionReport && msg.redactionReport.totalRedacted > 0 && (
                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-emerald-400 bg-emerald-950/20 px-2 py-1 rounded">
                  <div className="flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    <span>
                      Redacted {msg.redactionReport.totalRedacted} sensitive field
                      {msg.redactionReport.totalRedacted > 1 ? 's' : ''} (
                      {msg.redactionReport.redactedLabels.join(', ')})
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-500 font-mono">Protected</span>
                </div>
              )}

              {/* Action Plan Card */}
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1">
                      <Play className="w-3 h-3" /> Action Plan ({msg.actions.length} step
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

                  <div className="space-y-1.5">
                    {msg.actions.map((act) => (
                      <div
                        key={act.id}
                        onMouseEnter={() => handleHighlightElement(act.refId)}
                        onMouseLeave={handleClearHighlight}
                        className={`flex items-center justify-between p-2 rounded-lg text-xs border transition-colors ${
                          act.status === 'completed'
                            ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                            : act.status === 'failed'
                            ? 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-indigo-500/50'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px] uppercase">
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
          <div className="flex items-center gap-2 text-xs text-indigo-400 p-2 bg-indigo-950/20 rounded-lg border border-indigo-500/20 animate-pulse">
            <Sparkles className="w-4 h-4 animate-spin-slow" />
            <span>Analyzing DOM and formulating response...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Action Suggestions */}
      <div className="px-3 py-2 bg-slate-900/30 border-t border-slate-800/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <button
          onClick={() => handleSendMessage('Summarize the key information on this webpage.')}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-medium transition-colors whitespace-nowrap"
        >
          <FileText className="w-3 h-3 text-indigo-400" />
          Summarize Page
        </button>
        <button
          onClick={() => handleSendMessage('List all interactive form inputs on this page.')}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-medium transition-colors whitespace-nowrap"
        >
          <MousePointer className="w-3 h-3 text-emerald-400" />
          Find Forms
        </button>
        <button
          onClick={() => handleSendMessage('Explain what actions can be taken on this page.')}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-medium transition-colors whitespace-nowrap"
        >
          <HelpCircle className="w-3 h-3 text-amber-400" />
          Available Actions
        </button>
      </div>

      {/* Query Input Box */}
      <div className="p-3 bg-slate-900 border-t border-slate-800">
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
            className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50"
          />
          <Button
            type="submit"
            size="md"
            variant="primary"
            disabled={!inputQuery.trim() || isLoading}
            isLoading={isLoading}
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </form>
      </div>
    </div>
  );
};
