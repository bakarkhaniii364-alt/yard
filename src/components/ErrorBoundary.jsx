import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Yard Crash:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      const isChunkError = this.state.error?.name === 'ChunkLoadError' || 
                          this.state.error?.message?.includes('Failed to fetch dynamically imported module');

      return (
        // 1. Outer Container: Matches your app's theme background
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-8 bg-[var(--bg-main)] text-[var(--text-main)] font-mono">
          
          {/* Solution 31: Consistent Grid Opacity (Matches App.jsx) */}
          <div className="absolute inset-0 bg-pattern-grid opacity-10 pointer-events-none" />
          
          {/* 2. The Retro Window Wrapper */}
          <div className="relative w-full max-w-5xl flex flex-col retro-border retro-shadow-dark animate-in fade-in zoom-in-95 duration-300">
            
            {/* Window Header (Theme colored) */}
            <div className="bg-[var(--border)] text-[var(--text-on-border)] px-3 py-2 flex justify-between items-center border-b-2 border-[var(--border)] select-none">
              <span className="font-black text-xs sm:text-sm tracking-widest uppercase flex items-center gap-2">
                {isChunkError ? 'system_update.exe' : 'fatal_exception.exe'}
              </span>
              {/* Fake window controls */}
              <div className="flex gap-1.5">
                 <div className="w-3 h-3 border-2 border-current opacity-50"></div>
                 <div className="w-3 h-3 border-2 border-current opacity-50"></div>
                 <div className="w-3 h-3 border-2 border-current bg-white"></div>
              </div>
            </div>

            {/* 3. Window Content: The Classic BSOD */}
            <div className="bg-[#0078d7] text-white p-6 sm:p-10 flex flex-col selection:bg-white selection:text-[#0078d7]">
              <h1 className="text-6xl sm:text-8xl font-bold mb-6" style={{ fontFamily: "var(--font-display)" }}>:(</h1>
              
              <p className="text-lg sm:text-2xl font-bold leading-tight mb-4">
                {isChunkError 
                  ? "A new version of the Yard is available, but some local files are out of sync."
                  : "Your yard ran into a problem that it couldn't handle, and now it needs to refresh."}
              </p>
              
              <p className="text-sm sm:text-base opacity-90 mb-8">
                {isChunkError 
                  ? "Please update to synchronize with the latest sanctuary protocols."
                  : "You can look for the error in the console."}
              </p>

              {/* The Error Output Box */}
              <div className="relative group p-4 bg-black/30 border-2 border-dashed border-white/30 text-sm overflow-x-auto max-h-40 overflow-y-auto">
                <button 
                  onClick={() => {
                    const cleanStack = this.state.errorInfo?.componentStack?.replace(/https?:\/\/[^\/]+/g, '') || '';
                    const errStr = `${this.state.error}\n${cleanStack}`;
                    navigator.clipboard.writeText(errStr);
                  }}
                  className="absolute top-2 right-2 px-3 py-1 bg-white/20 hover:bg-white/40 text-white text-[10px] font-bold uppercase tracking-widest border-2 border-transparent hover:border-white transition-all opacity-0 group-hover:opacity-100"
                >
                  Copy Log
                </button>
                <p className="font-bold text-red-200 mb-2">
                  {this.state.error && this.state.error.toString()}
                </p>
                <pre className="text-[10px] sm:text-xs opacity-90 whitespace-pre-wrap leading-relaxed">
                  {this.state.errorInfo && this.state.errorInfo.componentStack?.replace(/https?:\/\/[^\/]+/g, '')}
                </pre>
              </div>

              {/* Action Buttons */}
              <div className="pt-8 flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-4">
                <a 
                  href="https://www.facebook.com/bakarkhaniii/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-6 py-2 bg-transparent text-white border-2 border-white font-black uppercase tracking-widest hover:bg-white/10 transition-transform active:translate-y-[2px] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] text-xs sm:text-sm text-center"
                >
                  Contact Developer
                </a>
                <button
                  onClick={() => window.location.href = '/'}
                  className="px-6 py-2 bg-white text-[#0078d7] font-black uppercase tracking-widest hover:bg-gray-200 transition-transform active:translate-y-[2px] border-2 border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] text-xs sm:text-sm"
                >
                  {isChunkError ? 'Update & Synchronize' : 'Restart Yard'}
                </button>
              </div>

            </div>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}
