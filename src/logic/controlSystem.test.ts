import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CONTROL_SYSTEM,
  isValidControlSystem,
  reconcileActiveTab,
} from './controlSystem';

describe('controlSystem', () => {
  it('has carrera as the default system', () => {
    expect(DEFAULT_CONTROL_SYSTEM).toBe('carrera');
  });

  it('validates carrera and hoja-de-ruta as valid systems', () => {
    expect(isValidControlSystem('carrera')).toBe(true);
    expect(isValidControlSystem('hoja-de-ruta')).toBe(true);
  });

  it('rejects invalid or unknown values', () => {
    expect(isValidControlSystem('other')).toBe(false);
    expect(isValidControlSystem('')).toBe(false);
    expect(isValidControlSystem(null)).toBe(false);
    expect(isValidControlSystem(undefined)).toBe(false);
    expect(isValidControlSystem(123)).toBe(false);
  });
});

describe('reconcileActiveTab', () => {
  it('returns CARRERA tab when system is carrera and tab is null', () => {
    expect(reconcileActiveTab(null, 'carrera')).toBe('CARRERA');
  });

  it('returns HOJA-DE-RUTA tab when system is hoja-de-ruta and tab is null', () => {
    expect(reconcileActiveTab(null, 'hoja-de-ruta')).toBe('HOJA-DE-RUTA');
  });

  it('preserves CALCULADORA tab regardless of control system', () => {
    expect(reconcileActiveTab('CALCULADORA', 'carrera')).toBe('CALCULADORA');
    expect(reconcileActiveTab('CALCULADORA', 'hoja-de-ruta')).toBe('CALCULADORA');
  });

  it('switches a stale CARRERA tab to HOJA-DE-RUTA when system changes', () => {
    expect(reconcileActiveTab('CARRERA', 'hoja-de-ruta')).toBe('HOJA-DE-RUTA');
  });

  it('switches a stale HOJA-DE-RUTA tab to CARRERA when system changes', () => {
    expect(reconcileActiveTab('HOJA-DE-RUTA', 'carrera')).toBe('CARRERA');
  });

  it('returns correct tab for valid matching tab + system pairs', () => {
    expect(reconcileActiveTab('CARRERA', 'carrera')).toBe('CARRERA');
    expect(reconcileActiveTab('HOJA-DE-RUTA', 'hoja-de-ruta')).toBe('HOJA-DE-RUTA');
  });

  it('reconciles invalid/unknown tab values safely to the system race tab', () => {
    expect(reconcileActiveTab('', 'carrera')).toBe('CARRERA');
    expect(reconcileActiveTab(undefined, 'hoja-de-ruta')).toBe('HOJA-DE-RUTA');
    expect(reconcileActiveTab('BOGUS' as string, 'carrera')).toBe('CARRERA');
  });

  describe('reload with a stale persisted tab value', () => {
    it('reconciles stale CARRERA tab to HOJA-DE-RUTA when stored control system is hoja-de-ruta', () => {
      // Simulate page reload: localStorage has stale tab 'CARRERA' but system is 'hoja-de-ruta'
      const stalePersistedTab = 'CARRERA';
      const persistedSystem = 'hoja-de-ruta';
      const reconciled = reconcileActiveTab(stalePersistedTab, persistedSystem);
      expect(reconciled).toBe('HOJA-DE-RUTA');
    });

    it('reconciles stale HOJA-DE-RUTA tab to CARRERA when stored control system is carrera', () => {
      const stalePersistedTab = 'HOJA-DE-RUTA';
      const persistedSystem = 'carrera';
      const reconciled = reconcileActiveTab(stalePersistedTab, persistedSystem);
      expect(reconciled).toBe('CARRERA');
    });

    it('keeps CALCULADORA tab on reload with either control system', () => {
      expect(reconcileActiveTab('CALCULADORA', 'hoja-de-ruta')).toBe('CALCULADORA');
      expect(reconcileActiveTab('CALCULADORA', 'carrera')).toBe('CALCULADORA');
    });
  });

  describe('switching systems then APLICAR workflow', () => {
    it('reconciles active tab when switching from carrera to hoja-de-ruta and applying', () => {
      // User was on CARRERA tab in carrera mode
      let activeTab = 'CARRERA';
      // User opens Preparar etapa, switches control system to hoja-de-ruta
      const newSystem = 'hoja-de-ruta';
      // System changes: tab reconciles
      activeTab = reconcileActiveTab(activeTab, newSystem);
      expect(activeTab).toBe('HOJA-DE-RUTA');
      // On APLICAR, return to main with reconciled tab
      const finalTab = reconcileActiveTab(activeTab, newSystem);
      expect(finalTab).toBe('HOJA-DE-RUTA');
    });

    it('preserves CALCULADORA tab when switching systems and applying', () => {
      let activeTab = 'CALCULADORA';
      const newSystem = 'hoja-de-ruta';
      activeTab = reconcileActiveTab(activeTab, newSystem);
      expect(activeTab).toBe('CALCULADORA');
    });
  });
});
