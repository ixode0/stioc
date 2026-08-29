declare module "lucide-react" {
  import * as React from "react";
  export type IconProps = React.SVGProps<SVGSVGElement> & { size?: number | string; color?: string; strokeWidth?: number | string };
  export type Icon = React.FC<IconProps>;
  export const Search: Icon;
  export const X: Icon;
  export const Wand2: Icon;
  export const Wand: Icon;
  export const Sparkles: Icon;
  export const Settings: Icon;
  export const Terminal: Icon;
  export const Folder: Icon;
  export const File: Icon;
  // fallback for any other icon
  const LucideIcon: Icon;
  export default LucideIcon;
}
