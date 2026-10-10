import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export default function InteriorLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <><SiteHeader /><main>{children}</main><SiteFooter /></>;
}
