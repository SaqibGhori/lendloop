"use client";

import { Component, type ReactNode } from "react";
import { ConvexError } from "convex/values";

/** Keeps one failing query (network blip, timeout, permission error) from blanking the whole app. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const message = error instanceof ConvexError ? String(error.data) : "This page could not load its data.";
    return (
      <div className="card space-y-3 text-center">
        <p className="text-stone-700">{message}</p>
        <button className="btn-ghost" onClick={() => this.setState({ error: null })}>
          Try again
        </button>
      </div>
    );
  }
}
