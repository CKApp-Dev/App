import { describe, expect, jest, test } from '@jest/globals';

import { parseEmbeddedArray, parseCountdown, soapEnvelope, trainLineColor } from './metro';
import { linesOfStation, METRO_LINE_COLORS } from './metro-lines';
import { availabilityLevel, CK_COORDINATE, nearestStations, normalizeNtc, normalizeTpc, parseStationTime } from './youbike';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));

describe('YouBike feeds', () => {
  test('reads current and legacy New Taipei counts without turning missing counts into zero', () => {
    const common = { sna: 'YouBike2.0_測試', sarea: '板橋區', lat: '25.03', lng: '121.51' };
    expect(normalizeNtc({ ...common, sbi_quantity: '4', bemp: '0' })).toMatchObject({ rent: 4, return: 0 });
    expect(normalizeNtc({ ...common, sbi: '2' })).toMatchObject({ rent: 2, return: null });
    expect(normalizeNtc({ ...common, sbi_quantity: '-1', bemp: '' })).toMatchObject({ rent: null, return: null });
    expect(availabilityLevel(0)).toBe('none');
    expect(availabilityLevel(null)).toBe('unknown');
  });

  test('parses Taipei timestamps across both feeds and rejects invalid calendar dates', () => {
    expect(parseStationTime('2026-10-04 09:39:03')?.toISOString()).toBe('2026-10-04T01:39:03.000Z');
    expect(parseStationTime('20261004T093903')?.toISOString()).toBe('2026-10-04T01:39:03.000Z');
    expect(parseStationTime('20260230093903')).toBeNull();
    expect(parseStationTime(undefined)).toBeNull();
  });

  test('returns the nearest nine in distance order and excludes unusable coordinates', () => {
    const stations = Array.from({ length: 12 }, (_, index) => normalizeTpc({
      sna: `YouBike2.0_${index}`, sarea: '中正區', latitude: CK_COORDINATE.latitude + index / 1000,
      longitude: CK_COORDINATE.longitude, available_rent_bikes: index, available_return_bikes: 10,
    })).reverse();
    stations.push({ ...stations[0], sna: 'invalid', latitude: Number.NaN });
    stations.push({ ...stations[0], sna: 'out-of-range', latitude: 91 });
    const result = nearestStations(stations, CK_COORDINATE.latitude, CK_COORDINATE.longitude);
    expect(result).toHaveLength(9);
    expect(result[0].sna).toBe('YouBike2.0_0');
    expect(result[8].sna).toBe('YouBike2.0_8');
    expect(result[0].distanceKm).toBe(0);
  });
});

describe('Metro feed', () => {
  const soapResponse = (method: string) =>
    `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><${method}Response xmlns="http://tempuri.org/" /></soap:Body></soap:Envelope>`;

  test.each(['getTrackInfo', 'getCarWeightByInfoEx'])('reads JSON before the live %s SOAP trailer', (method) => {
    const records = [{ TrainNumber: '201', StationName: '西門站' }];
    expect(parseEmbeddedArray(JSON.stringify(records) + soapResponse(method))).toEqual(records);
    expect(parseEmbeddedArray('[]' + soapResponse(method))).toEqual([]);
  });

  test('reads plain JSON and ignores brackets and XML markers inside escaped JSON strings', () => {
    const records = [{ StationName: 'A ] [ "quoted" \\ <?xml', nested: [[1, 2], []] }];
    expect(parseEmbeddedArray(JSON.stringify(records))).toEqual(records);
    expect(parseEmbeddedArray('\uFEFF \n' + JSON.stringify(records) + '\n' + soapResponse('getTrackInfo'))).toEqual(records);
  });

  test('rejects incomplete JSON, arbitrary trailing text, and trailing SOAP faults', () => {
    const fault = '<soap:Envelope><soap:Body><soap:Fault><faultstring>Invalid account</faultstring></soap:Fault></soap:Body></soap:Envelope>';
    expect(() => parseEmbeddedArray('[{"StationName":"A"}')).toThrow();
    expect(() => parseEmbeddedArray('[{"StationName":}]')).toThrow();
    expect(() => parseEmbeddedArray('[] unexpected text')).toThrow();
    expect(() => parseEmbeddedArray('[]<soap:Envelope>')).toThrow();
    expect(() => parseEmbeddedArray('[]' + fault)).toThrow();
    expect(() => parseEmbeddedArray('[]' + soapResponse('getTrackInfo') + '<garbage/>')).toThrow();
  });

  test('extracts SOAP JSON with escaped names and distinguishes a valid empty feed from a fault', () => {
    const soap = '<soap:Envelope><soap:Body><getTrackInfoResponse><getTrackInfoResult>[{&quot;StationName&quot;:&quot;A &amp; B&quot;}]</getTrackInfoResult></getTrackInfoResponse></soap:Body></soap:Envelope>';
    expect(parseEmbeddedArray(soap)).toEqual([{ StationName: 'A & B' }]);
    expect(parseEmbeddedArray('<string>[]</string>')).toEqual([]);
    expect(() => parseEmbeddedArray('<soap:Fault><faultstring>Invalid account</faultstring></soap:Fault>')).toThrow();
  });

  test('escapes credentials in SOAP without changing the requested method', () => {
    expect(soapEnvelope('getTrackInfo', { user: 'a&b', pass: '<secret>' })).toContain('<userName>a&amp;b</userName>');
    expect(soapEnvelope('getTrackInfo', { user: 'a&b', pass: '<secret>' })).toContain('<passWord>&lt;secret&gt;</passWord>');
  });

  test('rounds countdowns across minutes and recognizes operational status', () => {
    expect(parseCountdown('1:59')).toEqual({ kind: 'time', minutes: 2, seconds: 0 });
    expect(parseCountdown('列車進站')).toEqual({ kind: 'arriving' });
    expect(parseCountdown('營運時間已過')).toEqual({ kind: 'closed' });
    expect(parseCountdown('unavailable')).toEqual({ kind: 'unknown' });
  });

  test('preserves interchange lines and distinguishes trains sharing a destination', () => {
    expect(linesOfStation('景安')).toEqual(['O', 'Y']);
    expect(trainLineColor('南港展覽館站', '忠孝復興', '')).toBe(METRO_LINE_COLORS.BR);
    expect(trainLineColor('南港展覽館站', '忠孝復興', '123')).toBe(METRO_LINE_COLORS.BL);
  });
});
