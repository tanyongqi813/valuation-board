export interface SectorL2 {
  code: string
  name: string
  date: string
  close: number
  ma200: number
  dev_ma200: number
  price_pctile_5y: number
  high_52w: number
  low_52w: number
  pe_ttm: number | null
  pct_chg: number | null
  level1: string
}

export interface SectorL1 {
  name: string
  date: string
  syn_close: number
  ma200: number
  dev_ma200: number
  price_pctile_5y: number
  pe_ttm_median: number | null
  member_count: number
  members: string[]
  /* 港美股 ETF/指数直接作为一级行业时使用的字段 */
  code?: string
  close?: number
  pct_chg?: number | null
  pe_ttm?: number | null
  high_52w?: number
  low_52w?: number
}

export interface MarketData {
  level1: SectorL1[]
  level2: SectorL2[]
}

export interface BoardData {
  a: MarketData | null
  hk: MarketData | null
  us: MarketData | null
  updated_at: string
}
