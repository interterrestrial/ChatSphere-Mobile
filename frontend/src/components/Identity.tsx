export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
      ChatSphere
    </span>
  );
}

const tones: Record<string, string> = {
  maya: 'indigo', jordan: 'sand', priya: 'spruce', eli: 'slate', sam: 'clay', noor: 'indigo',
};

export function Avatar({ name, id, size = 'regular' }: { name: string; id?: string; size?: 'small' | 'regular' }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return <span className={`avatar avatar--${tones[id ?? ''] ?? 'slate'} avatar--${size}`} aria-hidden="true">{initials}</span>;
}
