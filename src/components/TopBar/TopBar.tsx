import React, { useState } from 'react';
import { useStore } from '../../store/useStore';

export const TopBar: React.FC = () => {
  const {
    repoPath,
    isAnalyzing,
    openFolder,
    analyzeLocal,
    analyzeGitHub,
    error,
    clearError,
  } = useStore();

  const [showGitHub, setShowGitHub] = useState(false);
  const [githubRepo, setGithubRepo] = useState('');
  const [githubToken, setGithubToken] = useState('');

  const handleReanalyze = () => {
    if (!repoPath) return;
    if (repoPath.startsWith('github:')) {
      setShowGitHub(true);
    } else {
      analyzeLocal(repoPath);
    }
  };

  const handleGitHubAnalyze = () => {
    if (githubRepo.trim()) {
      analyzeGitHub(githubRepo.trim(), githubToken.trim());
      setShowGitHub(false);
    }
  };

  return (
    <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-3 shrink-0">
      {/* Repo path */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-gray-500 text-sm shrink-0">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
        </span>
        <span className="text-sm text-gray-400 truncate">
          {repoPath ?? 'No repository loaded'}
        </span>
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 rounded px-3 py-1">
          <span className="text-red-400 text-xs truncate max-w-64">{error}</span>
          <button
            onClick={clearError}
            className="text-red-400 hover:text-red-300 text-xs"
          >
            x
          </button>
        </div>
      )}

      {/* GitHub toggle */}
      {showGitHub && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="owner/repo"
            value={githubRepo}
            onChange={(e) => setGithubRepo(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-300 w-36 focus:outline-none focus:border-blue-500"
          />
          <input
            type="password"
            placeholder="token (optional)"
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-300 w-32 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleGitHubAnalyze}
            disabled={!githubRepo.trim() || isAnalyzing}
            className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
          >
            Analyze
          </button>
        </div>
      )}

      {/* Actions */}
      <button
        onClick={() => setShowGitHub(!showGitHub)}
        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
        title="GitHub repository"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
      </button>

      {repoPath && (
        <button
          onClick={handleReanalyze}
          disabled={isAnalyzing}
          className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 rounded border border-gray-700 transition-colors"
        >
          {isAnalyzing ? (
            <span className="flex items-center gap-1.5">
              <svg
                className="w-3 h-3 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Analyzing...
            </span>
          ) : (
            'Re-analyze'
          )}
        </button>
      )}

      <button
        onClick={openFolder}
        disabled={isAnalyzing}
        className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
      >
        Open Folder
      </button>
    </div>
  );
};
