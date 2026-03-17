import React, { useState, useEffect, useRef } from 'react';

interface GitHubModalProps {
  onAnalyze: (repo: string, token: string) => void;
  onClose: () => void;
}

const REPO_PATTERN = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;

export const GitHubModal: React.FC<GitHubModalProps> = ({ onAnalyze, onClose }) => {
  const [repo, setRepo] = useState('');
  const [token, setToken] = useState('');
  const repoInputRef = useRef<HTMLInputElement>(null);

  const repoTouched = repo.length > 0;
  const repoValid = REPO_PATTERN.test(repo);

  useEffect(() => {
    repoInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Focus trap
  useEffect(() => {
    const form = repoInputRef.current?.closest('form');
    if (!form) return;
    const focusable = form.querySelectorAll<HTMLElement>(
      'input, button, a[href], [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const trapFocus = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', trapFocus);
    return () => document.removeEventListener('keydown', trapFocus);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (repoValid) {
      onAnalyze(repo.trim(), token.trim());
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Connect GitHub repository"
    >
      <form
        onSubmit={handleSubmit}
        className="border shadow-2xl w-full max-w-md mx-4"
        style={{
          background: 'var(--color-bg-secondary)',
          borderColor: 'var(--color-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <h2
            className="font-mono text-xs tracking-widest uppercase"
            style={{ color: 'var(--color-accent)' }}
          >
            Connect GitHub Repo
          </h2>
        </div>

        {/* Body */}
        <div className="px-5 pb-4 flex flex-col gap-3">
          {/* Repo input */}
          <div className="flex flex-col gap-1">
            <div className="relative">
              <input
                ref={repoInputRef}
                type="text"
                placeholder="owner/repo"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                className="w-full border px-3 py-2 text-sm font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] pr-8"
                style={{
                  background: 'var(--color-bg-primary)',
                  borderColor: 'var(--color-border)',
                }}
              />
              {repoTouched && (
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm">
                  {repoValid ? (
                    <span style={{ color: '#3d8c5e' }}>&#10003;</span>
                  ) : (
                    <span style={{ color: '#c44' }}>&#10005;</span>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Token input */}
          <div className="flex flex-col gap-1">
            <input
              type="password"
              placeholder="Personal access token (optional for public repos)"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full border px-3 py-2 text-sm font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
              style={{
                background: 'var(--color-bg-primary)',
                borderColor: 'var(--color-border)',
              }}
            />
            <a
              href="https://github.com/settings/tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-mono tracking-wide hover:opacity-80 transition-opacity self-start"
              style={{ color: 'var(--color-accent)' }}
            >
              Get a token &rarr;
            </a>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex justify-end gap-2 px-5 py-3 border-t"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 font-mono text-[11px] tracking-widest uppercase text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-text-secondary)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!repoValid}
            className="px-4 py-1.5 font-mono text-[11px] tracking-widest uppercase border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Analyze
          </button>
        </div>
      </form>
    </div>
  );
};
