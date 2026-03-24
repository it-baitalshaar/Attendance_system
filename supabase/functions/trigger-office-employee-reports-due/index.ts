// Supabase Edge Function trigger for employee due reports.
// Intended to be called by Supabase Cron.
//
// Required Edge env vars:
// - APP_BASE_URL (e.g. https://baitalshaar.vercel.app)
// - CRON_SECRET  (must match Vercel CRON_SECRET)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function buildAuthHeaders(secret: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${secret}`,
    'X-Cron-Secret': secret,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const appBaseUrl = (Deno.env.get('APP_BASE_URL') || '').trim().replace(/\/+$/, '');
    const cronSecret = (Deno.env.get('CRON_SECRET') || '').trim();

    if (!appBaseUrl) {
      return new Response(
        JSON.stringify({ ok: false, error: 'APP_BASE_URL is not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    if (!cronSecret) {
      return new Response(
        JSON.stringify({ ok: false, error: 'CRON_SECRET is not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const url = `${appBaseUrl}/api/office/send-employee-reports-due`;
    const upstream = await fetch(url, {
      method: 'POST',
      headers: buildAuthHeaders(cronSecret),
      body: '{}',
    });

    const payload = await upstream.text().catch(() => '');
    return new Response(
      JSON.stringify({
        ok: upstream.ok,
        status: upstream.status,
        endpoint: url,
        payload,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: upstream.ok ? 200 : 502,
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
