import { useMemo, useState } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useBoardData } from './hooks/useBoardData'
import type { BoardData, MarketData, SectorL1, SectorL2 } from './types'

type Mkt = 'a' | 'hk' | 'us'

const TZ_LABEL: Record<Mkt, string> = {
  a: '北京时间',
  hk: '香港时间',
  us: '美东时间',
}

type SortKey = 'name' | 'close' | 'pct_chg' | 'ma200' | 'dev_ma200' | 'pctile' | 'pe'

const fmt = (v: number | null | undefined, d = 2) =>
  v === null || v === undefined ? '--' : Number(v).toFixed(d)

function PctileBar({ pct }: { pct: number | null | undefined }) {
  if (pct === null || pct === undefined)
    return <span className="text-xs text-muted-foreground">--</span>
  const p = Math.max(0, Math.min(100, pct))
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 w-24 overflow-hidden rounded-full bg-muted">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-blue-500/50"
          style={{ width: `${p}%` }}
        />
        <div
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
          style={{ left: `${p}%` }}
        />
      </div>
      <span className={`w-10 text-right text-xs tabular-nums ${pct < 10 ? 'font-medium text-blue-600' : 'text-muted-foreground'}`}>
        {pct.toFixed(0)}%
      </span>
    </div>
  )
}

function DevCell({ dev }: { dev: number | null | undefined }) {
  if (dev === null || dev === undefined) return <span>--</span>
  const below = dev < 0
  return (
    <span className={`tabular-nums ${below ? 'text-blue-600' : 'text-muted-foreground'}`}>
      {dev.toFixed(1)}%
      {below && (
        <Badge variant="secondary" className="ml-1.5 bg-blue-500/10 px-1 text-[10px] text-blue-600 hover:bg-blue-500/10">
          线下
        </Badge>
      )}
    </span>
  )
}

function ChgCell({ v }: { v: number | null | undefined }) {
  if (v === null || v === undefined) return <span>--</span>
  return (
    <span className={`tabular-nums ${v > 0 ? 'text-red-600' : v < 0 ? 'text-emerald-600' : ''}`}>
      {v > 0 ? '+' : ''}
      {v.toFixed(2)}%
    </span>
  )
}

interface RowModel {
  l1: SectorL1
  l2: SectorL2[]
}

function sortRows(rows: RowModel[], key: SortKey, dir: 1 | -1): RowModel[] {
  const val = (r: RowModel): number | string => {
    const s = r.l1
    switch (key) {
      case 'name': return s.name
      case 'close': return s.syn_close ?? s.close ?? 0
      case 'pct_chg':
        return s.pct_chg ?? r.l2.reduce((a, m) => a + (m.pct_chg ?? 0), 0) / (r.l2.length || 1)
      case 'ma200': return s.ma200
      case 'dev_ma200': return s.dev_ma200
      case 'pctile': return s.price_pctile_5y
      case 'pe': return s.pe_ttm_median ?? s.pe_ttm ?? 9999
    }
  }
  return [...rows].sort((a, b) => {
    const va = val(a), vb = val(b)
    const c = typeof va === 'string' ? va.localeCompare(String(vb), 'zh') : va - (vb as number)
    return c * dir
  })
}

function SortHeader({ label, k, sortKey, sortDir, onSort }: {
  label: string; k: SortKey; sortKey: SortKey; sortDir: 1 | -1; onSort: (k: SortKey) => void
}) {
  const active = sortKey === k
  return (
    <TableHead className="sticky top-0 z-10 cursor-pointer select-none bg-background text-right" onClick={() => onSort(k)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (sortDir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
      </span>
    </TableHead>
  )
}

function MarketPanel({ mkt, data }: { mkt: Mkt; data: BoardData }) {
  const market: MarketData | null = data[mkt]
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [filter, setFilter] = useState<'all' | 'below' | 'low'>('all')
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('dev_ma200')
  const [sortDir, setSortDir] = useState<1 | -1>(1)

  const rows = useMemo<RowModel[]>(() => {
    if (!market) return []
    const q = query.trim()
    let rs: RowModel[] = market.level1.map((l1) => ({
      l1,
      l2: market.level2.filter((s) => s.level1 === l1.name),
    }))
    if (filter === 'below') rs = rs.filter((r) => r.l1.dev_ma200 < 0)
    if (filter === 'low') rs = rs.filter((r) => r.l1.price_pctile_5y < 30)
    if (q) rs = rs.filter((r) => r.l1.name.includes(q) || r.l2.some((m) => m.name.includes(q)))
    return sortRows(rs, sortKey, sortDir)
  }, [market, filter, query, sortKey, sortDir])

  if (!market) {
    return (
      <div className="flex flex-col items-center gap-2 py-24 text-center">
        <p className="text-lg font-medium">数据接入中</p>
        <p className="max-w-md text-sm text-muted-foreground">
          该市场的板块行情与 PE 将通过 Yahoo Finance 数据源接入（含 200 日均线与估值分位），上线后自动展示于此。
        </p>
      </div>
    )
  }

  const belowCnt = market.level1.filter((s) => s.dev_ma200 < 0).length
  const lowCnt = market.level1.filter((s) => s.price_pctile_5y < 10).length
  const midCnt = market.level1.filter((s) => s.price_pctile_5y >= 10 && s.price_pctile_5y < 30).length

  const onSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === 1 ? -1 : 1))
    else { setSortKey(k); setSortDir(1) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">一级行业 {market.level1.length}</Badge>
        <Badge variant="outline" className="gap-1"><span className="inline-block h-2 w-2 rounded-full bg-blue-500" />低于 MA200 · {belowCnt}</Badge>
        <Badge variant="outline" className="gap-1"><span className="inline-block h-2 w-2 rounded-full bg-blue-700" />分位 &lt;10% · {lowCnt}</Badge>
        <Badge variant="outline">分位 10–30% · {midCnt}</Badge>
        <Badge variant="secondary" className="gap-1 font-normal text-amber-700 dark:text-amber-400">
          数据基于 {market.level1[0]?.date}（{TZ_LABEL[mkt]}）收盘
        </Badge>
        <div className="ml-auto flex items-center gap-2">
          <Input
            placeholder="搜索行业…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 w-40"
          />
          <div className="flex overflow-hidden rounded-md border">
            {([['all', '全部'], ['below', '仅线下'], ['low', '低分位']] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`px-3 py-1.5 text-xs transition-colors ${filter === k ? 'bg-foreground text-background' : 'hover:bg-muted'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border">
        <div className="max-h-[68vh] overflow-auto">
          <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="sticky top-0 z-10 bg-background">行业（一级 ▸ 二级）</TableHead>
              <SortHeader label="点位" k="close" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="涨跌幅" k="pct_chg" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="MA200" k="ma200" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="偏离MA200" k="dev_ma200" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="5年分位" k="pctile" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="PE-TTM" k="pe" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <TableHead className="sticky top-0 z-10 bg-background text-right text-muted-foreground">景气</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ l1, l2 }) => {
              const open = !!expanded[l1.name]
              return [
                <TableRow
                  key={l1.name}
                  className="cursor-pointer"
                  onClick={() => setExpanded((p) => ({ ...p, [l1.name]: !p[l1.name] }))}
                >
                  <TableCell className="font-medium">
                    <span className="mr-1 inline-flex w-4 items-center text-muted-foreground">
                      {l2.length > 0 && (open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />)}
                    </span>
                    {l1.name}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(l1.syn_close ?? l1.close)}</TableCell>
                  <TableCell className="text-right"><ChgCell v={l1.pct_chg ?? (l2.length ? l2.reduce((a, m) => a + (m.pct_chg ?? 0), 0) / l2.length : null)} /></TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(l1.ma200)}</TableCell>
                  <TableCell className="text-right"><DevCell dev={l1.dev_ma200} /></TableCell>
                  <TableCell><PctileBar pct={l1.price_pctile_5y} /></TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(l1.pe_ttm_median ?? l1.pe_ttm, 1)}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">待接入</TableCell>
                </TableRow>,
                ...(open
                  ? l2.map((m) => (
                      <TableRow key={l1.name + '/' + m.code} className="bg-muted/30 hover:bg-muted/50">
                        <TableCell className="pl-10 text-sm text-muted-foreground">{m.name}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{fmt(m.close)}</TableCell>
                        <TableCell className="text-right text-sm"><ChgCell v={m.pct_chg} /></TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{fmt(m.ma200)}</TableCell>
                        <TableCell className="text-right text-sm"><DevCell dev={m.dev_ma200} /></TableCell>
                        <TableCell><PctileBar pct={m.price_pctile_5y} /></TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{fmt(m.pe_ttm, 1)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">--</TableCell>
                      </TableRow>
                    ))
                  : []),
              ]
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                  没有符合条件的行业
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        位置条 = 近 5 年价格分位（● 为当前位置）；「线下」= 现价低于 200 日均线；一级行业 PE 为旗下二级板块中位数；景气评分将结合财报超预期与分析师预期修正（A股用 iFinD 一致预期，港美股用 guidance vs actual，待接入）。
      </p>
    </div>
  )
}

export default function App() {
  const { data, error } = useBoardData()
  const [mkt, setMkt] = useState<Mkt>('a')

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-6 py-4">
          <div>
            <h1 className="text-xl font-medium">估值瞭望台</h1>
            <p className="text-xs text-muted-foreground">
              A股 · 港股 · 美股行业估值面板 —— PE 分位 / 200 日均线 / 5 年价格分位
            </p>
          </div>
          <div className="ml-auto flex items-center gap-4">
            {data && (
              <span className="text-xs text-muted-foreground">
                面板生成于 {data.updated_at}（本机时间）
              </span>
            )}
            <Tabs value={mkt} onValueChange={(v) => setMkt(v as Mkt)}>
              <TabsList>
                <TabsTrigger value="a">A股</TabsTrigger>
                <TabsTrigger value="hk">港股</TabsTrigger>
                <TabsTrigger value="us">美股</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {error && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
            数据文件加载失败：{error}。请先运行工作区的 fetch_boards_a.py 生成 data/boards.json。
          </div>
        )}
        {!data && !error && (
          <div className="py-24 text-center text-muted-foreground">正在加载数据…</div>
        )}
        {data && <MarketPanel mkt={mkt} data={data} />}
      </main>
    </div>
  )
}
