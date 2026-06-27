export function isMarketingShellPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/product" ||
    pathname === "/oplossingen" ||
    pathname === "/over-ons" ||
    pathname === "/contact" ||
    pathname.startsWith("/oplossingen/")
  );
}

export function isPublicRuntimePath(pathname: string) {
  const isPublicMarketingPath = ["/", "/product", "/oplossingen", "/over-ons", "/contact"].includes(pathname);
  const isAuthPath = pathname.startsWith("/login") || pathname.startsWith("/register");
  return (
    isPublicMarketingPath ||
    isAuthPath ||
    pathname.startsWith("/embed") ||
    pathname.startsWith("/review/") ||
    pathname.startsWith("/client-portal/")
  );
}

export function isAppShellPath(pathname: string) {
  return !isPublicRuntimePath(pathname);
}
