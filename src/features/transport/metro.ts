// Live Taipei Metro arrivals and car crowdedness from api.metro.taipei, ported
// from the Quasar app's MetroSection.vue.
//
// The API accepts SOAP requests. Responses either embed JSON in SOAP or send
// a JSON array followed by an empty SOAP response envelope.
import Constants from 'expo-constants';
import { XMLParser } from 'fast-xml-parser';

import { getText } from '@/lib/http';

import { METRO_LINE_COLORS, linesOfStation } from './metro-lines';

const API_BASE = 'https://api.metro.taipei/metroapi';

export interface TrackInfo {
  StationName: string;
  DestinationName: string;
  /** "2:35", or one of the COUNTDOWN_* strings. */
  CountDown: string;
  TrainNumber: string;
}

export interface CarWeight {
  TrainNumber: string;
  Cart1L: string;
  Cart2L: string;
  Cart3L: string;
  Cart4L: string;
  Cart5L: string;
  Cart6L: string;
}

export const COUNTDOWN_ARRIVING = '列車進站';
export const COUNTDOWN_CLOSED = '營運時間已過';

interface MetroCredentials {
  user: string;
  pass: string;
}

function credentials(): MetroCredentials {
  const config = Constants.expoConfig?.extra?.metroApi as Partial<MetroCredentials> | undefined;
  return { user: config?.user ?? '', pass: config?.pass ?? '' };
}

export function hasMetroCredentials(): boolean {
  const { user, pass } = credentials();
  return user !== '' && pass !== '';
}

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export function soapEnvelope(method: string, { user, pass }: MetroCredentials): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
<soap:Body>
<${method} xmlns="http://tempuri.org/">
<userName>${escapeXml(user)}</userName>
<passWord>${escapeXml(pass)}</passWord>
</${method}>
</soap:Body>
</soap:Envelope>`;
}

/** Finds the end of a leading JSON array without treating brackets in strings as structure. */
function arrayEnd(body: string): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === '[') depth += 1;
    else if (char === ']' && --depth === 0) return index + 1;
  }
  throw new Error('捷運服務未回傳有效資料');
}

/** Extracts the JSON array from either Metro response format. */
export function parseEmbeddedArray<T>(body: string): T[] {
  const text = body.trim();
  if (text.startsWith('[')) {
    const end = arrayEnd(text);
    const records = JSON.parse(text.slice(0, end)) as T[];
    const trailing = text.slice(end).trim();
    if (trailing) {
      // The live service writes JSON before ASP.NET appends its SOAP envelope.
      // Validate that suffix rather than accepting arbitrary text or a fault.
      const soap = new XMLParser({ ignoreAttributes: true, parseTagValue: false, removeNSPrefix: true }).parse(
        trailing,
        true,
      ) as { Envelope?: { Body?: Record<string, unknown> } };
      const soapBody = soap.Envelope?.Body;
      const responses = soapBody && typeof soapBody === 'object' ? Object.keys(soapBody) : [];
      if (
        Object.keys(soap).some((key) => key !== '?xml' && key !== 'Envelope') ||
        responses.length !== 1 ||
        !responses[0].endsWith('Response')
      ) {
        throw new Error('捷運服務未回傳有效資料');
      }
    }
    return records;
  }
  // Parsing the XML also decodes entities in station/destination names. A
  // SOAP fault or rejected account must surface as an error, not an empty
  // list that looks like a successful update.
  const findArray = (value: unknown): T[] | null => {
    if (typeof value === 'string' && value.trim().startsWith('[')) {
      const parsed: unknown = JSON.parse(value.trim());
      if (Array.isArray(parsed)) return parsed as T[];
    }
    if (value !== null && typeof value === 'object') {
      for (const nested of Object.values(value)) {
        const result = findArray(nested);
        if (result !== null) return result;
      }
    }
    return null;
  };
  const value: unknown = new XMLParser({ ignoreAttributes: true, parseTagValue: false }).parse(text);
  const records = findArray(value);
  if (records === null) throw new Error('捷運服務未回傳有效資料');
  return records;
}

async function callSoap<T>(service: string, method: string, signal?: AbortSignal): Promise<T[]> {
  const body = await getText(`${API_BASE}/${service}.asmx`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: `http://tempuri.org/${method}`,
    },
    body: soapEnvelope(method, credentials()),
    signal,
  });
  return parseEmbeddedArray<T>(body);
}

export function fetchTrackInfo(signal?: AbortSignal): Promise<TrackInfo[]> {
  return callSoap<TrackInfo>('TrackInfo', 'getTrackInfo', signal);
}

export function fetchCarWeights(signal?: AbortSignal): Promise<CarWeight[]> {
  return callSoap<CarWeight>('CarWeight', 'getCarWeightByInfoEx', signal);
}

/** The API names stations "西門站", except 台北車站 which already ends in 站. */
export function apiStationName(station: string): string {
  return station === '台北車站' ? station : `${station}站`;
}

export function arrivalsAt(trackInfo: TrackInfo[], station: string): TrackInfo[] {
  const name = apiStationName(station);
  return trackInfo.filter((info) => info.StationName === name);
}

/** "南港展覽館站" -> "南港展覽館" */
export function destinationLabel(destinationName: string): string {
  return destinationName.replace(/站$/, '');
}

export type Countdown =
  | { kind: 'arriving' }
  | { kind: 'closed' }
  | { kind: 'time'; minutes: number; seconds: number }
  | { kind: 'unknown' };

/** Parses CountDown, rounding "m:ss" to the nearest 5 seconds like before. */
export function parseCountdown(countDown: string): Countdown {
  if (countDown === COUNTDOWN_ARRIVING) return { kind: 'arriving' };
  if (countDown === COUNTDOWN_CLOSED) return { kind: 'closed' };
  const match = /^(\d+):(\d+)$/.exec(countDown);
  if (!match) return { kind: 'unknown' };
  const total = Math.round((Number(match[1]) * 60 + Number(match[2])) / 5) * 5;
  return { kind: 'time', minutes: Math.floor(total / 60), seconds: total % 60 };
}

/**
 * The colour of the line a train runs on, judged from its destination: the
 * line shared by the current station and the destination.
 */
export function trainLineColor(
  destinationName: string,
  currentStation: string,
  trainNumber: string,
): string | null {
  const destination = destinationLabel(destinationName);
  // 忠孝復興 -> 南港展覽館 is served by both 板南線 and 文湖線; only 板南線
  // trains report a train number.
  if (currentStation === '忠孝復興' && destination === '南港展覽館') {
    return trainNumber === '' ? METRO_LINE_COLORS.BR : METRO_LINE_COLORS.BL;
  }
  const destLines = linesOfStation(destination);
  const shared = destLines.find((line) => linesOfStation(currentStation).includes(line));
  const line = shared ?? destLines[0];
  return line ? METRO_LINE_COLORS[line] : null;
}

/** Per-car crowdedness (1 = 低 ... 4 = 極高) of a train, front car first. */
export function carCrowdedness(weights: CarWeight[], trainNumber: string): number[] {
  if (!trainNumber) return [];
  const train = weights.find((w) => w.TrainNumber === trainNumber);
  if (!train) return [];
  return [train.Cart1L, train.Cart2L, train.Cart3L, train.Cart4L, train.Cart5L, train.Cart6L].map(
    (level) => Number.parseInt(level, 10),
  );
}

export type CrowdLevel = 'low' | 'medium' | 'high' | 'veryHigh';

export function crowdLevel(level: number): CrowdLevel {
  if (!(level > 1)) return 'low';
  if (level === 2) return 'medium';
  if (level === 3) return 'high';
  return 'veryHigh';
}

export const CROWD_COLORS: Record<CrowdLevel, string> = {
  low: '#8BC34A',
  medium: '#FFCA28',
  high: '#FFA726',
  veryHigh: '#BF360C',
};

export const CROWD_LABELS: Record<CrowdLevel, string> = {
  low: '低',
  medium: '中',
  high: '高',
  veryHigh: '極高',
};
