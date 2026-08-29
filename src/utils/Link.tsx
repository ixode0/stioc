import * as React from "react";
// TODO: migrate remote -> electronAPI

export const Link: React.FC<{absolutePath: string, children: any}> = ({
  absolutePath,
  children,
}: any) => <span
  style={{cursor: "pointer"} as any}
  className="underlineOnHover"
  onClick={() => (window as any).electronAPI?.openExternal(`file://${absolutePath}`)}
>{children}</span>;
