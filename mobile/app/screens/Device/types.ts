export type HistoryStatus =
  | 'ok'
  | 'noData'
  | 'circuitOpen'
  | 'upstreamError'
  | 'otherError'
  | 'offline'
  | 'disabled'
  | 'vendorDisabled';
