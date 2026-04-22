'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FileText, Images, Sparkles, Bell, Plug, Settings, BarChart3,
} from 'lucide-react'

const NAV_TOP = [
  { href: '/', label: '대시보드', icon: LayoutDashboard },
  { href: '/report', label: '리포트', icon: FileText },
  { href: '/analytics', label: '이벤트', icon: BarChart3 },
  { href: '/creatives', label: '소재', icon: Images },
  { href: '/ai', label: 'AI', icon: Sparkles },
  { href: '/automation', label: '자동화', icon: Bell },
  { href: '/integrations', label: '연결', icon: Plug },
] as const

const NAV_BOTTOM = [
  { href: '/settings', label: '설정', icon: Settings },
] as const

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  // 첫 세그먼트로 활성 여부 판단 (쿼리스트링·동적 파라미터 고려)
  const base = href.split('?')[0]                // 예: '/analytics/1042'
  const topSegment = '/' + base.split('/')[1]    // 예: '/analytics'
  if (!topSegment || topSegment === '/') return pathname === base
  return pathname === base || pathname.startsWith(topSegment + '/') || pathname === topSegment
}

export function Sidebar() {
  const pathname = usePathname()

  const renderItem = (item: typeof NAV_TOP[number] | typeof NAV_BOTTOM[number]) => {
    const Icon = item.icon
    const active = isActive(pathname, item.href)
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`group relative flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 transition-colors ${
          active
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
        title={item.label}
      >
        <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
        <span className="text-[10px] font-medium">{item.label}</span>
      </Link>
    )
  }

  return (
    <aside className="hidden md:flex flex-col shrink-0 border-r border-border bg-white/60 backdrop-blur sticky top-0 h-screen"
           style={{ width: 72 }}>
      <div className="flex items-center justify-center h-14 border-b border-border">
        <Link href="/" className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 text-white font-bold text-sm flex items-center justify-center" title="Booster Dashboard">
          B
        </Link>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        {NAV_TOP.map(renderItem)}
      </nav>
      <div className="px-2 py-3 border-t border-border space-y-1">
        {NAV_BOTTOM.map(renderItem)}
      </div>
    </aside>
  )
}

/** 모바일: 하단 고정 탭바 (md 미만에서 표시) */
export function MobileTabBar() {
  const pathname = usePathname()
  const items = [...NAV_TOP, ...NAV_BOTTOM]
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white/95 backdrop-blur">
      <div className="flex">
        {items.slice(0, 5).map((item) => {
          const Icon = item.icon
          const active = isActive(pathname, item.href)
          return (
            <Link key={item.href} href={item.href}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] ${
                    active ? 'text-primary' : 'text-muted-foreground'
                  }`}>
              <Icon size={18} />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
