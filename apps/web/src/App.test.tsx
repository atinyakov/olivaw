import {
  fireEvent,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { FleetSnapshot } from '@olivaw/contracts';
import { robots, sites } from '@olivaw/contracts/fixtures';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';
import { FleetClient } from './fleet-client.js';

class MockEventSource {
  static instance: MockEventSource;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  listeners = new Map<string, (event: MessageEvent) => void>();
  constructor(public url: string) {
    MockEventSource.instance = this;
  }
  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    this.listeners.set(type, listener as (event: MessageEvent) => void);
  }
  close() {}
}

const snapshot: FleetSnapshot = {
  eventId: 1,
  serverTime: '2026-08-24T12:00:00Z',
  sites: [...sites],
  robots: [...robots],
  telemetry: {
    'bf-01': {
      robotId: 'bf-01',
      sequence: 1,
      observedAt: new Date().toISOString(),
      batteryPercent: 82,
      position: { x: 20, y: 30, heading: 90 },
      speedMps: 1.2,
      task: 'Delivering tote',
    },
    'bf-02': {
      robotId: 'bf-02',
      sequence: 1,
      observedAt: new Date().toISOString(),
      batteryPercent: 12,
      position: { x: 40, y: 50, heading: 180 },
      speedMps: 0.5,
      task: 'Returning',
    },
  },
  statuses: Object.fromEntries(
    robots.map((robot) => [
      robot.id,
      robot.id === 'bf-01'
        ? 'operational'
        : robot.id === 'bf-02'
          ? 'warning'
          : 'offline',
    ]),
  ),
  history: Object.fromEntries(robots.map((robot) => [robot.id, []])),
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('fleet dashboard', () => {
  it('shows fleet status, filters robots, and opens details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(snapshot))),
    );
    vi.stubGlobal('EventSource', MockEventSource);
    render(<App client={new FleetClient('http://api')} />);
    expect(
      await screen.findByText('Fleet health, at a glance.'),
    ).toBeInTheDocument();
    MockEventSource.instance.onopen?.();
    await waitFor(() =>
      expect(screen.getByText('Live telemetry')).toBeInTheDocument(),
    );
    const adaMarker = screen.getByRole('button', {
      name: /Ada, Operational, battery 82 percent/,
    });
    expect(adaMarker.querySelector('path')).toHaveAttribute(
      'transform',
      'rotate(180)',
    );
    fireEvent.change(screen.getByPlaceholderText('Search robots'), {
      target: { value: 'Ada' },
    });
    expect(
      screen.getByRole('button', { name: 'Open details for Ada' }),
    ).toBeInTheDocument();
    const opener = screen.getByRole('button', {
      name: 'Open details for Ada',
    });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Ada' });
    expect(dialog).toBeInTheDocument();
    expect(document.querySelector('main')).toHaveAttribute('inert');
    expect(
      screen.getByRole('button', { name: 'Close robot details' }),
    ).toHaveFocus();
    expect(within(dialog).getByText('82%')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Close robot details' }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Open details for Ada' }),
    ).toHaveFocus();
    expect(document.querySelector('main')).not.toHaveAttribute('inert');
  });

  it('exposes mobile view selection to assistive technology', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(snapshot))),
    );
    vi.stubGlobal('EventSource', MockEventSource);
    render(<App client={new FleetClient('http://api')} />);
    await screen.findByText('Fleet health, at a glance.');

    const map = screen.getByRole('button', { name: 'Map', hidden: true });
    const list = screen.getByRole('button', { name: 'List', hidden: true });
    expect(map).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(list);
    expect(map).toHaveAttribute('aria-pressed', 'false');
    expect(list).toHaveAttribute('aria-pressed', 'true');
  });

  it('offers recovery when the API is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down')),
    );
    vi.stubGlobal('EventSource', MockEventSource);
    render(<App client={new FleetClient('http://api')} />);
    expect(
      await screen.findByText('Fleet service unavailable'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument();
  });
});
