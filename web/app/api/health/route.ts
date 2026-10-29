export const maxDuration = 60;

// pings the bot service so a sleeping host wakes up before the first real message
export async function GET() {
  const url = process.env.BOT_API_URL;
  if (!url) {
    return Response.json({ ok: false }, { status: 500 });
  }

  try {
    const res = await fetch(`${url}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(55000), // give up before the function limit
    });
    return Response.json({ ok: res.ok });
  } catch {
    return Response.json({ ok: false }, { status: 502 });
  }
}