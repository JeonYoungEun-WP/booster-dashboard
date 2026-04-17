'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/', label: '대시보드' },
  { href: '/report', label: '리포트' },
  { href: '/creatives', label: '소재별' },
  { href: '/ai', label: 'AI 분석' },
  { href: '/integrations', label: '매체 연결' },
];

export function AdSubNav() {
  const pathname = usePathname();
  return (
    <div className="flex gap-2 text-sm border-b border-border mb-4">
      {ITEMS.map((it) => {
        const active = pathname === it.href;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`px-3 py-2 -mb-px border-b-2 transition-colors ${
              active
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}
