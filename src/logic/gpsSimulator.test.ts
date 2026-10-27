import { describe, it, expect } from 'vitest';
import { GpsSimulator } from './gpsSimulator';
import { filterGpsReading } from './gpsFilter';
import { haversineDistanceMeters } from './geo';

describe('GpsSimulator', () => {
  it('is completely deterministic when seeded', () => {
    const simA = new GpsSimulator({ seed: 42, speedKmH: 60 });
    const simB = new GpsSimulator({ seed: 42, speedKmH: 60 });

    const readingsA = [simA.tick(), simA.tick(), simA.tick(), simA.tick()];
    const readingsB = [simB.tick(), simB.tick(), simB.tick(), simB.tick()];

    expect(readingsA).toEqual(readingsB);
  });

  it('produces expected step distance for configured speed', () => {
    // 72 km/h = 20 m/s. With 0 noise:
    const sim = new GpsSimulator({
      speedKmH: 72,
      noiseMeters: 0,
      intervalMs: 1000,
    });

    const r1 = sim.tick();
    const r2 = sim.tick();

    const distance = haversineDistanceMeters(r1.latitude, r1.longitude, r2.latitude, r2.longitude);
    expect(distance).toBeCloseTo(20.0, 1);
    expect(r2.speed).toBeCloseTo(20.0, 2);
  });

  it('injects poor accuracy and filter rejects it', () => {
    const sim = new GpsSimulator({ seed: 99 });
    const r1 = sim.tick();
    const filter1 = filterGpsReading(r1, null);
    expect(filter1.accepted).toBe(true);

    sim.injectBadReading('poor_accuracy');
    const rBad = sim.tick();
    expect(rBad.accuracy).toBeGreaterThan(30);

    const filterBad = filterGpsReading(rBad, r1);
    expect(filterBad.accepted).toBe(false);
    expect(filterBad.reason).toBe('poor_accuracy');
  });

  it('injects duplicate timestamp and filter rejects it', () => {
    const sim = new GpsSimulator();
    const r1 = sim.tick();

    sim.injectBadReading('duplicate_timestamp');
    const rBad = sim.tick();
    expect(rBad.timestamp).toBe(r1.timestamp);

    const filterBad = filterGpsReading(rBad, r1);
    expect(filterBad.accepted).toBe(false);
    expect(filterBad.reason).toBe('timestamp_out_of_order');
  });

  it('injects out-of-order timestamp and filter rejects it', () => {
    const sim = new GpsSimulator();
    const r1 = sim.tick();

    sim.injectBadReading('out_of_order_timestamp');
    const rBad = sim.tick();
    expect(rBad.timestamp).toBeLessThan(r1.timestamp);

    const filterBad = filterGpsReading(rBad, r1);
    expect(filterBad.accepted).toBe(false);
    expect(filterBad.reason).toBe('timestamp_out_of_order');
  });

  it('injects implausible jump and filter rejects it', () => {
    const sim = new GpsSimulator();
    const r1 = sim.tick();

    sim.injectBadReading('implausible_jump');
    const rBad = sim.tick();

    const filterBad = filterGpsReading(rBad, r1);
    expect(filterBad.accepted).toBe(false);
    expect(filterBad.reason).toBe('implausible_speed');
  });
});
