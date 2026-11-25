import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#090A0F] text-[#F8FAFC] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#12141C] border border-[#232736] rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-extrabold text-[#E5B869]">
              TEAM FX — সমস্যা হয়েছে
            </h2>
            <p className="text-sm font-bold text-[#94A3B8] break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-2.5 px-4 bg-[#E5B869] text-[#090A0F] rounded-lg font-extrabold text-sm hover:bg-[#F0C87D] transition-colors cursor-pointer"
            >
              পেজ রিলোড করুন
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
