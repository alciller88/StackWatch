import React from 'react';
import { useStore } from '../../store/useStore';

export const Dashboard: React.FC = () => {
  const { openFolder, isAnalyzing } = useStore();

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        {/* Icon */}
        <div className="mb-6 flex justify-center">
          <div className="w-20 h-20 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-blue-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-100 mb-2">
          Welcome to <span className="text-blue-400">Stack</span>Watch
        </h1>

        {/* Description */}
        <p className="text-gray-400 text-sm mb-2">
          Visualize and monitor all the services, dependencies, and external
          accounts your project relies on.
        </p>
        <p className="text-gray-500 text-xs mb-8">
          Open a local repository or connect to GitHub to automatically detect
          your project&apos;s tech stack, services, and infrastructure.
        </p>

        {/* CTA */}
        <button
          onClick={openFolder}
          disabled={isAnalyzing}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          {isAnalyzing ? (
            <>
              <svg
                className="w-4 h-4 animate-spin"
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
            </>
          ) : (
            <>
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
              Open a Repository
            </>
          )}
        </button>

        <p className="text-xs text-gray-500 mt-3">
          Or use the GitHub button in the top bar to analyze a remote repository
        </p>

        {/* Features */}
        <div className="mt-10 grid grid-cols-3 gap-4 text-left">
          <div className="p-3 rounded-lg bg-gray-900 border border-gray-800">
            <div className="text-blue-400 text-lg mb-1">&#9881;</div>
            <h3 className="text-xs font-medium text-gray-300 mb-1">Services</h3>
            <p className="text-xs text-gray-500">
              Detect hosting, payments, auth, and more from your codebase.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-gray-900 border border-gray-800">
            <div className="text-green-400 text-lg mb-1">&#9776;</div>
            <h3 className="text-xs font-medium text-gray-300 mb-1">Dependencies</h3>
            <p className="text-xs text-gray-500">
              Browse all packages with version, type, and ecosystem info.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-gray-900 border border-gray-800">
            <div className="text-amber-400 text-lg mb-1">&#9889;</div>
            <h3 className="text-xs font-medium text-gray-300 mb-1">Flow Graph</h3>
            <p className="text-xs text-gray-500">
              Interactive architecture diagram of your app data flow.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
