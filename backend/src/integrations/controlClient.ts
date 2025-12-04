export async function sendControlOverHttp(
  deviceExternalId: string,
  body: { type: 'setpoint' | 'mode'; payload: object },
  config: { url: string; apiKey: string }
) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    Authorization: `Bearer ${config.apiKey}`,
  };

  const res = await fetch(`${config.url.replace(/\/$/, '')}/devices/${deviceExternalId}/commands`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`CONTROL_HTTP_FAILED:${res.status}:${detail.slice(0, 120)}`);
  }
}
