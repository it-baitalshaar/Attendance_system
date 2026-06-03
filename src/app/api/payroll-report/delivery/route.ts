import { NextResponse } from 'next/server';
import { createSupabaseServerComponentClient } from '@/lib/supabaseAppRouterClient';
import { DEFAULT_WHATSAPP } from '@/lib/payrollReportWhatsApp';

export async function GET() {
  try {
    const supabase = createSupabaseServerComponentClient();
    const { data: emails, error: emailErr } = await supabase
      .from('payroll_report_emails')
      .select('id, email, created_at')
      .order('created_at', { ascending: true });

    if (emailErr) {
      return NextResponse.json({ error: emailErr.message }, { status: 500 });
    }

    const { data: settings, error: settingsErr } = await supabase
      .from('payroll_report_settings')
      .select('whatsapp_number')
      .eq('scope', 'default')
      .maybeSingle();

    if (settingsErr) {
      return NextResponse.json({ error: settingsErr.message }, { status: 500 });
    }

    return NextResponse.json({
      emails: emails ?? [],
      whatsappNumber: settings?.whatsapp_number ?? DEFAULT_WHATSAPP,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const whatsappNumber = String(body?.whatsappNumber ?? '').trim();
    if (!whatsappNumber) {
      return NextResponse.json({ error: 'WhatsApp number is required' }, { status: 400 });
    }

    const supabase = createSupabaseServerComponentClient();
    const { error } = await supabase.from('payroll_report_settings').upsert(
      {
        scope: 'default',
        whatsapp_number: whatsappNumber,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'scope' }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, whatsappNumber });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
