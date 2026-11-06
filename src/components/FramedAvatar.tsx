'use client';

import Avatar from './Avatar';
import type { FrameDef } from '@/lib/unlocks';

/** The profile photo with the frame the user unlocked, if any. */
export default function FramedAvatar({ frame, ...props }: { frame: FrameDef | null; src?: string; name?: string; size?: number }) {
  if (!frame) return <Avatar {...props} />;
  return (
    <span className="avatar-frame" data-glow={frame.glow ? 'true' : undefined} style={{ ['--frame' as string]: frame.color }}>
      <Avatar {...props} />
    </span>
  );
}
