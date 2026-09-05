import * as React from "react";
// TODO: migrate remote -> electronAPI
// B5: https-only links. main intentionally blocks file:// in openExternal
// (arbitrary local files would open in other apps), so local paths are
// rendered inert instead of producing a "Blocked external URL" dead click.
// (Opening local files needs a separate shell.openPath IPC — not added here.)

// Matches main's ALLOWED_EXTERNAL for http(s). mailto: is not linkified here.
const HTTP_URL = /^https?:\/\/[^\s]*$/i;

export const Link: React.FC<{absolutePath: string, children: any}> = ({
  absolutePath,
  children,
}: any) => {
  const target = String(absolutePath ?? "");
  const isHttp = HTTP_URL.test(target.trim()) && target.trim().length <= 2048;
  return <span
    style={{cursor: isHttp ? "pointer" : "default"} as any}
    className={isHttp ? "underlineOnHover" : undefined}
    title={target}
    onClick={() => {
      if (isHttp) {
        // Silent catch: no alert() popups for link failures (main rejects
        // file:// etc. with an error; Menu.ts surfaces those where needed).
        (window as any).electronAPI?.openExternal(target.trim())?.catch?.(() => {});
      }
    }}
  >{children}</span>;
};
