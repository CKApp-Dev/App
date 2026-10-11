export const PAGE_SIZE = 100;
export const MAX_PAGES_PER_RUN = 5;
export const MAX_SEND_ATTEMPTS = 5;
export const LEASE_MS = 6 * 60_000;
export const RECEIPT_DELAY_MS = 15 * 60_000;
export const RECEIPT_EXPIRY_MS = 23 * 60 * 60_000;

export function shouldPublish(status: unknown, publishAtMillis: number, nowMillis: number): boolean {
  return status === 'scheduled' && Number.isFinite(publishAtMillis) && publishAtMillis <= nowMillis;
}

export function retryDelay(attempt: number): number {
  return Math.min(60 * 60_000, 60_000 * 2 ** Math.min(Math.max(attempt - 1, 0), 6));
}

export function ticketDisposition(error: string | undefined): 'remove' | 'retry' | 'failed' {
  if (error === 'DeviceNotRegistered') return 'remove';
  if (error === 'MessageRateExceeded' || error === 'TOO_MANY_REQUESTS') return 'retry';
  return 'failed';
}

export function pushBody(body: string): string {
  const characters = Array.from(body);
  return characters.length > 240 ? `${characters.slice(0, 239).join('')}…` : body;
}
