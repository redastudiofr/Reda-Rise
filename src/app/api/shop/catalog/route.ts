import { NextResponse } from 'next/server';
import { fetchCatalogue } from '@/lib/shop';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The redastudio.fr catalogue, read from the shop's public product feed. */
export async function GET() {
  const products = await fetchCatalogue();
  if (!products) {
    return NextResponse.json(
      { error: 'Le catalogue de redastudio.fr n’a pas pu être lu automatiquement. Ajoute les pièces à la main avec leur lien redastudio.fr.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  return NextResponse.json({ products }, { headers: { 'Cache-Control': 'no-store' } });
}
