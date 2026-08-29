// STIOC 2026 - updated typings (original from 2015, refreshed for TS 5.7)
declare module "child-process-promise" {
  function execFile(file: string, args: string[], options: {}): Promise<{stdout: string, stderr: string}>
}
