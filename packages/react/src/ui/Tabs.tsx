import { createContext, useContext, type ReactNode } from 'react'
import { cn } from '../utils/cn'

interface TabsContextValue {
  active: string
  setActive: (value: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabsContext(component: string): TabsContextValue {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error(`<${component}> must be used inside <Tabs>`)
  return ctx
}

export function Tabs({
  value,
  onValueChange,
  className,
  children,
}: {
  value: string
  onValueChange: (value: string) => void
  className?: string
  children?: ReactNode
}) {
  return (
    <TabsContext.Provider value={{ active: value, setActive: onValueChange }}>
      <div className={cn('xpe-tabs', className)}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({ className, children }: { className?: string; children?: ReactNode }) {
  return <div className={cn('xpe-tabs-list', className)}>{children}</div>
}

export function TabsTrigger({
  value,
  className,
  children,
}: {
  value: string
  className?: string
  children?: ReactNode
}) {
  const ctx = useTabsContext('TabsTrigger')
  const isActive = ctx.active === value

  return (
    <button
      type="button"
      className={cn('xpe-tabs-trigger', isActive && 'xpe-tabs-trigger--active', className)}
      onClick={() => ctx.setActive(value)}
    >
      {children}
    </button>
  )
}

export function TabsContent({
  value,
  className,
  children,
}: {
  value: string
  className?: string
  children?: ReactNode
}) {
  const ctx = useTabsContext('TabsContent')
  if (ctx.active !== value) return null

  return <div className={cn('xpe-tabs-content', className)}>{children}</div>
}
