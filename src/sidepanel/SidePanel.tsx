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
  Square,
  Maximize2,
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

const MAX_AGENT_STEPS = 20;

export const SidePanel: React.FC = () => {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [domSummary, setDomSummary] = useState<ExtractedDOMSummary | null>(null);
  const [activeTabUrl, setActiveTabUrl] = useState('');
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);
  const [runningTaskMessageId, setRunningTaskMessageId] = useState<string | null>(null);

  const coordinatorRef = useRef(new AgentCoordinator());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const backendTasksRef = useRef(new Map<string, string>());
  const localEntityValuesRef = useRef(new Map<string, string>());
  const cancelTaskRef = useRef(false);

  const openScreenshotViewer = (src: string, title: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const storageKey = `sihext_screenshot_preview_${id}`;
    chrome.storage.local.set({ [storageKey]: { src, title } }, () => {
      if (chrome.runtime.lastError) return;
      const viewerUrl = new URL(chrome.runtime.getURL('screenshot.html'));
      viewerUrl.searchParams.set('id', id);
      chrome.windows.create({
        url: viewerUrl.toString(),
        type: 'popup',
        width: 1200,
        height: 850,
        focused: true,
      }, () => {
        if (chrome.runtime.lastError) chrome.storage.local.remove(storageKey);
      });
    });
  };

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
            content: `👋 **Welcome to Auxilium AI Assistant!**\n\nI can analyze this webpage, answer questions, or execute actions on your behalf using **on-device YOLO** or our **Self-Hosted Model Backend**.\n\n🛡️ **Privacy Shield**: Recognized sensitive DOM fields are masked before backend requests when redaction is enabled. Face detection is not available yet.`,
            timestamp: Date.now(),
            modelUsed: "Auxilium System",
          },
        ]);
      }
    });

    refreshCurrentTabDOM();

    return () => {
      cancelTaskRef.current = true;
      sendMessageToActiveTab({ type: "CLEANUP_OVERLAYS" }).catch(() => {});
    };
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
      sendMessageToActiveTab({ type: "CLEANUP_OVERLAYS" }).catch(() => {});
    } catch {
      // Content script may not be injected yet
    }
  };

  const captureCurrentPageState = async (fallbackDOM?: ExtractedDOMSummary) => {
    const domRes = await sendMessageToActiveTab<undefined, ExtractedDOMSummary>({
      type: 'GET_PAGE_DOM',
    });
    const currentDOM = domRes.success && domRes.data ? domRes.data : fallbackDOM;
    if (!currentDOM) {
      throw new Error(domRes.error || 'Unable to read the active page DOM.');
    }
    setDomSummary(currentDOM);
    setActiveTabUrl(currentDOM.url);

    const valuesRes = await sendMessageToBackground<undefined, Record<string, string>>({
      type: 'GET_ENTITY_VALUES',
    });
    if (valuesRes.success && valuesRes.data) {
      for (const [label, value] of Object.entries(valuesRes.data)) {
        localEntityValuesRef.current.set(label, value);
      }
    }

    let screenshotUrl: string | undefined;
    const screenshotRes = await sendMessageToBackground<undefined, string>({
      type: 'CAPTURE_TAB',
    });
    if (screenshotRes.success && screenshotRes.data) {
      screenshotUrl = screenshotRes.data;
    }

    return { dom: currentDOM, screenshotUrl };
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
      coordinatorRef.current.resetHistory();
      backendTasksRef.current.clear();
      localEntityValuesRef.current.clear();
      await sendMessageToBackground({ type: 'START_NEW_TASK' });
      const { dom: currentDOM, screenshotUrl } = await captureCurrentPageState(domSummary || undefined);

      // 3. Coordinate AI execution (router -> on-device YOLO / backend + privacy redaction)
      const { message: agentReply } = await coordinatorRef.current.executeAgentTurn(
        textToSend,
        currentDOM,
        settings,
        screenshotUrl
      );
      const hasLocalValueTokens = agentReply.isLocalExecution && (agentReply.actions || []).some((action) =>
        /^\[?[A-Za-z][A-Za-z0-9_]*-\d+\]?$/.test(action.value || '')
      );

      if (!agentReply.isLocalExecution) {
        const firstAction = agentReply.actions?.[0];
        if (firstAction && firstAction.type !== 'answer' && firstAction.type !== 'done') {
          backendTasksRef.current.set(agentReply.id, textToSend);
        } else {
          coordinatorRef.current.resetHistory();
          localEntityValuesRef.current.clear();
          await sendMessageToBackground({ type: 'START_NEW_TASK' });
        }
      } else if (!hasLocalValueTokens) {
        coordinatorRef.current.resetHistory();
        localEntityValuesRef.current.clear();
        await sendMessageToBackground({ type: 'START_NEW_TASK' });
      }
      setMessages((prev) => [...prev, agentReply]);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      coordinatorRef.current.resetHistory();
      localEntityValuesRef.current.clear();
      await sendMessageToBackground({ type: 'START_NEW_TASK' });
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
      sendMessageToActiveTab({ type: "CLEANUP_OVERLAYS" }).catch(() => {});
    }
  };

  const executeActionOnPage = async (
    action: AgentAction,
    backendAction = false
  ): Promise<{ success: boolean; message?: string }> => {
    let actionToExecute = action;
    const token = action.value?.match(/^\[?([A-Za-z][A-Za-z0-9_]*-\d+)\]?$/)?.[1];
    if (token) {
      const localValue = localEntityValuesRef.current.get(token);
      if (localValue === undefined) {
        return { success: false, message: `No local value is available for placeholder "${token}".` };
      }
      actionToExecute = { ...action, value: localValue };
    } else if (backendAction && action.type === 'type' && action.refId && action.value) {
      const targetRef = action.refId.startsWith('sihext-') ? action.refId : `sihext-${action.refId}`;
      const target = domSummary?.elements.find((element) => element.refId === targetRef);
      if (target?.isSensitive) {
        return { success: false, message: 'Backend must use a local value token for sensitive fields.' };
      }
    }

    const response = await sendMessageToActiveTab<AgentAction, { success: boolean; message?: string }>({
      type: 'EXECUTE_ACTION',
      payload: actionToExecute,
    });
    return {
      success: response.success && response.data?.success !== false,
      message: response.data?.message || response.error,
    };
  };

  const handleExecuteAction = async (
    action: AgentAction,
    messageId: string
  ): Promise<{ success: boolean; message?: string }> => {
    setExecutingActionId(action.id);

    let result: { success: boolean; message?: string };
    try {
      result = await executeActionOnPage(action, backendTasksRef.current.has(messageId));
    } catch (err: unknown) {
      result = { success: false, message: err instanceof Error ? err.message : String(err) };
    }

    if (backendTasksRef.current.has(messageId)) {
      coordinatorRef.current.recordExecutionResult(action, result);
    }
    setMessages((prev) => prev.map((msg) => {
      if (msg.id !== messageId || !msg.actions) return msg;
      return {
        ...msg,
        actions: msg.actions.map((item) => item.id === action.id
          ? { ...item, status: result.success ? 'completed' : 'failed', error: result.success ? undefined : result.message }
          : item),
      };
    }));
    setExecutingActionId(null);
    return result;
  };

  const stopAgentTask = () => {
    cancelTaskRef.current = true;
  };

  const runBackendTask = async (task: string, initialAction: AgentAction, messageId: string) => {
    cancelTaskRef.current = false;
    setRunningTaskMessageId(messageId);
    setIsLoading(true);

    let action = initialAction;
    let executedSteps = 0;
    const appendToMessage = (content: string, nextAction?: AgentAction) => {
      setMessages((prev) => prev.map((msg) => {
        if (msg.id !== messageId) return msg;
        return {
          ...msg,
          content: content ? `${msg.content}\n\n${content}` : msg.content,
          actions: nextAction ? [...(msg.actions || []), nextAction] : msg.actions,
        };
      }));
    };

    try {
      while (action && !cancelTaskRef.current) {
        if (action.type === 'answer' || action.type === 'done') break;
        if (action.status === 'pending') {
          if (executedSteps >= MAX_AGENT_STEPS) {
            appendToMessage(`Stopped at the ${MAX_AGENT_STEPS}-action safety limit.`);
            break;
          }
          await handleExecuteAction(action, messageId);
          executedSteps++;
          if (cancelTaskRef.current) break;
          if (executedSteps >= MAX_AGENT_STEPS) {
            appendToMessage(`Stopped at the ${MAX_AGENT_STEPS}-action safety limit.`);
            break;
          }
        }

        await new Promise((resolve) => setTimeout(resolve, settings.actionExecutionDelayMs || 300));
        const pageState = await captureCurrentPageState();
        const nextTurn = await coordinatorRef.current.executeAgentTurn(
          task,
          pageState.dom,
          { ...settings, routingMode: 'backend-only' },
          pageState.screenshotUrl
        );

        if (cancelTaskRef.current) break;
        if (nextTurn.routing.target !== 'backend') {
          throw new Error('Backend routing is unavailable; the task stopped.');
        }

        const nextAction = nextTurn.message.actions?.[0];
        if (!nextAction) {
          appendToMessage(nextTurn.message.content || 'The backend returned no next action.');
          break;
        }

        const isTerminal = nextAction.type === 'answer' || nextAction.type === 'done';
        action = { ...nextAction, status: isTerminal ? 'completed' : nextAction.status };
        appendToMessage(nextTurn.message.content, action);
      }

      if (cancelTaskRef.current) {
        appendToMessage('Task stopped.');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      appendToMessage(`Task stopped: ${errorMessage}`);
    } finally {
      backendTasksRef.current.delete(messageId);
      localEntityValuesRef.current.clear();
      await sendMessageToBackground({ type: 'START_NEW_TASK' });
      setRunningTaskMessageId(null);
      setExecutingActionId(null);
      setIsLoading(false);
    }
  };

  const handleExecuteAllActions = async (actions: AgentAction[], messageId: string) => {
    if (runningTaskMessageId === messageId) {
      stopAgentTask();
      return;
    }

    const task = backendTasksRef.current.get(messageId);
    if (task && actions[0]) {
      await runBackendTask(task, actions[0], messageId);
      return;
    }

    for (const act of actions) {
      if (act.status !== 'completed') {
        await handleExecuteAction(act, messageId);
        await new Promise((resolve) => setTimeout(resolve, settings.actionExecutionDelayMs || 300));
      }
    }
    coordinatorRef.current.resetHistory();
    localEntityValuesRef.current.clear();
    await sendMessageToBackground({ type: 'START_NEW_TASK' });
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
                      On-Device YOLO
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
                <div className="mt-3 pt-2 border-t border-sarvam-border/70 flex items-center justify-between text-[11px] text-emerald-400 bg-emerald-950/20 px-2.5 py-1.5 rounded-lg border">
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

              {msg.screenshotPreview && (
                <details className="mt-3 overflow-hidden rounded-lg border border-sarvam-border bg-sarvam-bg/70">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-emerald-300">
                    View privacy-redacted screenshot
                  </summary>
                  <img
                    src={msg.screenshotPreview}
                    alt={`Privacy-redacted screenshot of ${msg.pageContext?.title || 'the active webpage'}`}
                    loading="lazy"
                    className="block max-h-96 w-full border-t border-sarvam-border object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => openScreenshotViewer(
                      msg.screenshotPreview!,
                      msg.pageContext?.title || 'Active webpage'
                    )}
                    className="flex w-full items-center justify-center gap-1.5 border-t border-sarvam-border px-3 py-2 text-xs text-sarvam-secondary hover:bg-sarvam-card hover:text-white"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    Enlarge screenshot
                  </button>
                </details>
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
                      variant={runningTaskMessageId === msg.id ? 'danger' : 'primary'}
                      leftIcon={runningTaskMessageId === msg.id ? <Square className="w-3 h-3" /> : undefined}
                      onClick={() => runningTaskMessageId === msg.id
                        ? stopAgentTask()
                        : handleExecuteAllActions(msg.actions!, msg.id)}
                      disabled={runningTaskMessageId !== null && runningTaskMessageId !== msg.id
                        || runningTaskMessageId !== msg.id
                          && !backendTasksRef.current.has(msg.id)
                          && msg.actions.every((a) => a.status === 'completed' || a.type === 'answer' || a.type === 'done')}
                    >
                      {runningTaskMessageId === msg.id
                        ? 'Stop Task'
                        : backendTasksRef.current.has(msg.id) ? 'Run Task' : 'Execute All'}
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
                          {act.status === 'completed' || act.type === 'answer' || act.type === 'done' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : act.status === 'failed' ? (
                            <AlertTriangle className="w-4 h-4 text-rose-400" />
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              isLoading={executingActionId === act.id}
                              onClick={() => handleExecuteAction(act, msg.id)}
                              disabled={runningTaskMessageId !== null}
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
