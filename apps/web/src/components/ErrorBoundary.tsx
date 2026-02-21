import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, info: any) {
    console.error('Custom hackathon page crashed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white">
          <div className="p-8 rounded-xl border border-red-500 bg-red-900/20 max-w-md text-center">
            <h2 className="text-xl font-bold text-red-400 mb-3">
              Custom Page Failed
            </h2>
            <p className="text-red-200 text-sm">
              This hackathon has a custom page that contains an error.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
