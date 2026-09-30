import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Maximize2, ShieldCheck, X } from 'lucide-react';
import '../styles/globals.css';

interface ScreenshotData {
  src: string;
  title: string;
}

const ScreenshotViewer: React.FC = () => {
  const [screenshot, setScreenshot] = useState<ScreenshotData | null>(null);
  const [error, setError] = useState(false);

  const closeViewer = () => {
    chrome.windows.getCurrent((currentWindow) => {
      if (currentWindow.id !== undefined) chrome.windows.remove(currentWindow.id);
    });
  };

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) {
      setError(true);
      return;
    }

    const storageKey = `sihext_screenshot_preview_${id}`;
    chrome.storage.local.get(storageKey, (result) => {
      const data = result[storageKey] as ScreenshotData | undefined;
      chrome.storage.local.remove(storageKey);
      if (data?.src) setScreenshot(data);
      else setError(true);
    });
  }, []);

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#090c13] p-3 text-[#f3f5fa]">
      <section className="mx-auto flex h-full w-full max-w-[1500px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#11151e] shadow-2xl">
        <header className="flex h-[68px] shrink-0 items-center justify-between gap-4 border-b border-white/10 px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/10">
              <Maximize2 className="h-4 w-4 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold">Redacted screenshot</h1>
              {screenshot && <p className="truncate text-xs text-white/50">{screenshot.title}</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden items-center gap-1.5 text-xs text-emerald-300 sm:flex">
              <ShieldCheck className="h-3.5 w-3.5" />
              Privacy protected
            </span>
            <button
              type="button"
              aria-label="Close screenshot popup"
              title="Close"
              onClick={closeViewer}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-white/65 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 items-center justify-center bg-[#080b11] p-3 sm:p-5">
          {screenshot ? (
            <img
              src={screenshot.src}
              alt={`Privacy-redacted screenshot of ${screenshot.title}`}
              className="max-h-full max-w-full rounded-md border border-white/10 object-contain shadow-xl"
            />
          ) : error ? (
            <p className="max-w-sm text-center text-sm text-white/65">This screenshot preview is no longer available. Reopen it from the side panel.</p>
          ) : (
            <p className="text-sm text-white/65">Loading redacted screenshot...</p>
          )}
        </div>
        <footer className="flex h-9 shrink-0 items-center justify-center border-t border-white/10 text-[11px] text-white/40">
          Entire screenshot fitted to window
        </footer>
      </section>
    </main>
  );
};

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ScreenshotViewer />
  </React.StrictMode>
);