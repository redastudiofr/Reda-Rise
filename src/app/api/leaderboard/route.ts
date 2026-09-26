import { NextResponse } from 'next/server';
import { hasDatabase, listLeaderboard, publishToLeaderboard, removeFromLeaderboard } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Shared leaderboard.
 *
 * The app has one account per deployment, so a board only fills up when
 * several people point their app at the same database. Nothing is published
 * until the user turns sharing on, and only the pseudo and the numbers leave
 * the device — never the photo, the objectives or the finances.
 */

export async function GET() {
  try {
    return NextResponse.json({ rows: await listLeaderboard(), durable: hasDatabase() });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

type Body = { playerId?: unknown; pseudo?: unknown; xp?: unknown; level?: unknown; streak?: unknown };

function positiveInt(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const playerId = typeof body.playerId === 'string' ? body.playerId.trim() : '';
    const pseudo = typeof body.pseudo === 'string' ? body.pseudo.trim().slice(0, 24) : '';

    if (playerId === '' || pseudo === '') {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'Un identifiant et un pseudo sont nécessaires.' },
        { status: 400 },
      );
    }

    await publishToLeaderboard({
      playerId,
      pseudo,
      xp: positiveInt(body.xp),
      level: positiveInt(body.level, 1),
      streak: positiveInt(body.streak),
    });
    return NextResponse.json({ ok: true, durable: hasDatabase() });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const playerId = new URL(req.url).searchParams.get('playerId') ?? '';
    if (playerId === '') {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }
    await removeFromLeaderboard(playerId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
