// STIOC 2026 - updated typings (original from 2015, refreshed for TS 5.7)
declare module "dirStat" {
  function dirStat(path: string, cb: (err: any, results: any) => void): void
}
