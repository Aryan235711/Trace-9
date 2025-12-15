import React from 'react';

type Props = { children: React.ReactNode; fallback?: React.ReactNode };
type State = { hasError: boolean };

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: any) {
    // Here we could send the error to a monitoring service
    // console.error('ErrorBoundary caught', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div role="alert" className="p-4 bg-rose-500/10 rounded-md border border-rose-500/20">
          <div className="text-sm font-medium text-rose-500">Something went wrong rendering this component.</div>
        </div>
      );
    }
    return this.props.children;
  }
}
