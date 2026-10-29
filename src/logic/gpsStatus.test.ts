import { describe, it, expect } from 'vitest';
import { getGpsStatusText, getGpsStatusLine } from './gpsStatus';

describe('getGpsStatusText (backward-compatible wrapper)', () => {
  it('returns empty string when reader is idle', () => {
    expect(getGpsStatusText({ status: 'idle', hasReceivedReading: false })).toBe('');
    expect(getGpsStatusText({ status: 'idle', hasReceivedReading: true })).toBe('');
  });

  it('returns "GPS SIN PERMISO: activalo en Ajustes de iOS" when permission is denied', () => {
    expect(getGpsStatusText({ status: 'denied', hasReceivedReading: false })).toBe(
      'GPS SIN PERMISO: activalo en Ajustes de iOS'
    );
    expect(getGpsStatusText({ status: 'denied', hasReceivedReading: true })).toBe(
      'GPS SIN PERMISO: activalo en Ajustes de iOS'
    );
  });

  it('returns "GPS NO DISPONIBLE" when GPS is unavailable', () => {
    expect(getGpsStatusText({ status: 'unavailable', hasReceivedReading: false })).toBe(
      'GPS NO DISPONIBLE'
    );
    expect(getGpsStatusText({ status: 'unavailable', hasReceivedReading: true })).toBe(
      'GPS NO DISPONIBLE'
    );
  });

  it('returns "BUSCANDO GPS…" when status is timeout', () => {
    expect(getGpsStatusText({ status: 'timeout', hasReceivedReading: true })).toBe(
      'BUSCANDO GPS…'
    );
  });

  it('returns "BUSCANDO GPS…" when started (active) but no valid reading has arrived yet', () => {
    expect(getGpsStatusText({ status: 'active', hasReceivedReading: false })).toBe(
      'BUSCANDO GPS…'
    );
  });

  it('returns empty string when started (active) and a gap occurs after at least one valid reading', () => {
    expect(getGpsStatusText({ status: 'active', hasReceivedReading: true })).toBe('');
  });

  it('returns empty string when receiving fresh valid readings', () => {
    expect(getGpsStatusText({ status: 'active', hasReceivedReading: true })).toBe('');
  });
});

describe('getGpsStatusLine — kind field', () => {
  it('kind is "empty" when idle', () => {
    const r = getGpsStatusLine({ status: 'idle', hasReceivedReading: false });
    expect(r.kind).toBe('empty');
    expect(r.text).toBe('');
  });

  it('kind is "empty" when receiving fresh readings', () => {
    const r = getGpsStatusLine({ status: 'active', hasReceivedReading: true });
    expect(r.kind).toBe('empty');
    expect(r.text).toBe('');
  });

  it('kind is "searching" for BUSCANDO GPS… (active, no reading)', () => {
    const r = getGpsStatusLine({ status: 'active', hasReceivedReading: false });
    expect(r.kind).toBe('searching');
    expect(r.text).toBe('BUSCANDO GPS…');
  });

  it('kind is "empty" during a gap after at least one valid reading', () => {
    const r = getGpsStatusLine({ status: 'active', hasReceivedReading: true });
    expect(r.kind).toBe('empty');
    expect(r.text).toBe('');
  });

  it('kind is "searching" for timeout state', () => {
    const r = getGpsStatusLine({ status: 'timeout', hasReceivedReading: true });
    expect(r.kind).toBe('searching');
  });

  it('kind is "action-needed" for denied', () => {
    const r = getGpsStatusLine({ status: 'denied', hasReceivedReading: false });
    expect(r.kind).toBe('action-needed');
    expect(r.text).toBe('GPS SIN PERMISO: activalo en Ajustes de iOS');
  });

  it('kind is "action-needed" for unavailable', () => {
    const r = getGpsStatusLine({ status: 'unavailable', hasReceivedReading: false });
    expect(r.kind).toBe('action-needed');
    expect(r.text).toBe('GPS NO DISPONIBLE');
  });
});
