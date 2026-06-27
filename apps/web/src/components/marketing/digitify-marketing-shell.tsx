"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import {
  DIGITIFY_BRAND_SLOGAN,
  getDigitifySiteUrls,
  getUnifiedNavItems,
  getWordPressPageUrl,
  pageKeyToNavKey,
  type DigitifyNavChild,
  type DigitifyNavItem,
} from "@/lib/digitify-unified-nav";
import { isMarketingShellPath } from "@/lib/shell-paths";
import { DigitifyChatbotLoader } from "@/components/marketing/digitify-chatbot-loader";

type MarketingPageKey = "home" | "product" | "solutions" | "about" | "contact";

const ICONS = {
  phone:
    '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"/></svg>',
  mail:
    '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"/></svg>',
  map:
    '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"/></svg>',
  whatsapp:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>',
  facebook:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
  instagram:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>',
};

function icon(name: keyof typeof ICONS) {
  return <span dangerouslySetInnerHTML={{ __html: ICONS[name] }} aria-hidden="true" />;
}


function mobileNavItemClass(isActive: boolean, variant: "accent" | "muted" = "muted") {
  return [
    "digitify-mobile-nav__item",
    variant === "accent" ? "digitify-mobile-nav__item--accent" : "digitify-mobile-nav__item--muted",
    isActive ? "is-active" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: DigitifyNavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const className = `digitify-nav__link${item.shopAccent ? " digitify-nav__link--shop" : ""}${active ? " is-active" : ""}`;
  const content = <span className="digitify-nav__link-text">{item.label}</span>;
  if (item.external) {
    return (
      <a href={item.href} className={className} onClick={onNavigate} data-digitify-external="true">
        {content}
      </a>
    );
  }
  return (
    <Link href={item.href} className={className} onClick={onNavigate}>
      {content}
    </Link>
  );
}

function ShopNavDropdown({
  item,
  activeKey,
}: {
  item: DigitifyNavItem & { children: DigitifyNavChild[] };
  activeKey: ReturnType<typeof pageKeyToNavKey>;
}) {
  const parentActive =
    activeKey === item.key || item.children.some((child) => activeKey === child.key);
  const parentClass = `digitify-nav__link digitify-nav__link--shop${parentActive ? " is-active" : ""}`;
  const parentLink = item.external ? (
    <a href={item.href} className={parentClass}>
      <span className="digitify-nav__link-text">{item.label}</span>
      <span className="digitify-nav__caret" aria-hidden="true" />
    </a>
  ) : (
    <Link href={item.href} className={parentClass}>
      <span className="digitify-nav__link-text">{item.label}</span>
      <span className="digitify-nav__caret" aria-hidden="true" />
    </Link>
  );

  return (
    <li className="digitify-nav__item digitify-nav__item--has-dropdown" aria-haspopup="true">
      {parentLink}
      <ul className="digitify-nav__dropdown digitify-nav__dropdown--mega digitify-nav__dropdown--text">
        {item.children.map((child) => {
          const childActive = activeKey === child.key;
          const childClass = `digitify-nav__mega-link${childActive ? " is-active" : ""}`;
          return (
            <li key={child.key}>
              {child.external ? (
                <a href={child.href} className={childClass}>
                  <span className="digitify-nav__mega-text">{child.label}</span>
                </a>
              ) : (
                <Link href={child.href} className={childClass}>
                  <span className="digitify-nav__mega-text">{child.label}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </li>
  );
}

function flattenNavItems(items: DigitifyNavItem[]) {
  return items.flatMap((item) => {
    if (!item.children?.length) return [item];
    return [
      item,
      ...item.children.map((child) => ({
        ...child,
        shopAccent: true,
      })),
    ];
  });
}

function clearMarketingShellClasses() {
  document.body.classList.remove("digitify-leads-body", "theme-light", "digitify-menu-open", "digitify-scrolled");
  document.documentElement.classList.remove("digitify-shell-booting", "digitify-page-ready", "digitify-shell-ready");
}

function useDigitifyShellBoot() {
  useLayoutEffect(() => {
    document.body.classList.add("digitify-leads-body", "theme-light");

    const alreadyReady = document.documentElement.classList.contains("digitify-page-ready");
    if (!alreadyReady) {
      document.documentElement.classList.add("digitify-shell-booting");
    }

    let finished = false;
    const finishBoot = () => {
      if (finished) return;
      finished = true;
      document.documentElement.classList.add("digitify-page-ready", "digitify-shell-ready");
      document.documentElement.classList.remove("digitify-shell-booting");
    };

    if (alreadyReady) {
      finishBoot();
      return () => {
        window.setTimeout(() => {
          if (!isMarketingShellPath(window.location.pathname)) {
            clearMarketingShellClasses();
          }
        }, 0);
      };
    }

    const stylesheets = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).filter((link) =>
      link.href.includes("/digitify/"),
    );

    const waitForStyles =
      stylesheets.length === 0
        ? Promise.resolve()
        : Promise.all(
            stylesheets.map(
              (link) =>
                new Promise<void>((resolve) => {
                  if (link.sheet) {
                    resolve();
                    return;
                  }
                  const done = () => resolve();
                  link.addEventListener("load", done, { once: true });
                  link.addEventListener("error", done, { once: true });
                }),
            ),
          );

    const timeout = window.setTimeout(finishBoot, 900);
    void waitForStyles.finally(() => {
      window.clearTimeout(timeout);
      finishBoot();
    });

    return () => {
      window.clearTimeout(timeout);
      window.setTimeout(() => {
        if (!isMarketingShellPath(window.location.pathname)) {
          clearMarketingShellClasses();
        }
      }, 0);
    };
  }, []);

  useEffect(() => {

    const updateScroll = () => {
      const scrolled = window.scrollY > 20;
      document.querySelector(".digitify-site-header")?.classList.toggle("is-scrolled", scrolled);
      document.querySelector(".digitify-header")?.classList.toggle("is-scrolled", scrolled);
      document.body.classList.toggle("digitify-scrolled", scrolled);
      const scrollProgress = document.querySelector(".digitify-header__progress span") as HTMLElement | null;
      if (scrollProgress) {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const progress = maxScroll > 0 ? Math.min(100, (window.scrollY / maxScroll) * 100) : 0;
        scrollProgress.style.width = `${progress}%`;
      }
    };

    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });
    window.addEventListener("resize", updateScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("resize", updateScroll);
    };
  }, []);
}

export function DigitifyMarketingHeader({ activePage }: { activePage: MarketingPageKey }) {
  useDigitifyShellBoot();
  const urls = getDigitifySiteUrls();
  const navItems = getUnifiedNavItems({ site: "leads" });
  const activeKey = pageKeyToNavKey(activePage);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session, status } = useSession();
  const logoSrc = "/assets/branding/logo-header.png";

  useEffect(() => {
    document.body.classList.toggle("digitify-menu-open", mobileOpen);
    return () => document.body.classList.remove("digitify-menu-open");
  }, [mobileOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      <div className="digitify-ambient" aria-hidden="true">
        <div className="digitify-ambient__mesh" />
        <div className="digitify-ambient__orbs">
          <span className="digitify-ambient__orb--a" />
          <span className="digitify-ambient__orb--b" />
          <span className="digitify-ambient__orb--c" />
        </div>
      </div>

      <div id="digitifySiteHeaderWrap" className="digitify-site-header">
        <header className="digitify-header digitify-header--deck" role="banner">
          <div className="digitify-header__rail" aria-hidden="true">
            <span className="digitify-header__rail-accent" />
          </div>
          <div className="digitify-header__shell">
            <div className="digitify-header__grid digitify-header__grid--leads digitify-header__grid--ecosystem">
              <div className="digitify-header__start">
                <div className="digitify-header__brand">
                  <a href={getWordPressPageUrl("home", urls)} className="digitify-logo digitify-logo--header" aria-label="Digitify — Home">
                    <img
                      className="digitify-logo__img digitify-logo__img--brand"
                      src={logoSrc}
                      alt="Digitify"
                      width={132}
                      height={36}
                      loading="eager"
                      fetchPriority="high"
                      decoding="async"
                    />
                  </a>
                </div>
                <p className="digitify-header__tag">{DIGITIFY_BRAND_SLOGAN}</p>
              </div>

              <nav className="digitify-header__nav digitify-nav" role="navigation" aria-label="Hoofdnavigatie">
                <ul className="digitify-nav__list">
                  {navItems.map((item) => {
                    if (item.children?.length) {
                      return (
                        <ShopNavDropdown
                          key={item.key}
                          item={item as DigitifyNavItem & { children: DigitifyNavChild[] }}
                          activeKey={activeKey}
                        />
                      );
                    }
                    return (
                      <li key={item.key} className="digitify-nav__item">
                        <NavLink item={item} active={activeKey === item.key} />
                      </li>
                    );
                  })}
                </ul>
              </nav>

              <div className="digitify-header__end">
                <div className="digitify-header__actions">
                  <span className="digitify-header__auth">
                    {status === "authenticated" && session?.user ? (
                      <>
                        <Link className="digitify-header__auth-link" href="/dashboard">
                          Dashboard
                        </Link>
                        <button
                          type="button"
                          className="digitify-header__auth-link digitify-header__auth-link--solid"
                          onClick={() => signOut({ callbackUrl: "/" })}
                        >
                          Uitloggen
                        </button>
                      </>
                    ) : (
                      <>
                        <Link className="digitify-header__auth-link" href="/login">
                          Inloggen
                        </Link>
                        <Link className="digitify-header__auth-link digitify-header__auth-link--solid" href="/register">
                          Aanmelden
                        </Link>
                      </>
                    )}
                  </span>
                  <a href={getWordPressPageUrl("contact", urls)} className="digitify-header__cta">
                    <span className="digitify-header__cta-label">Offerte</span>
                    <span className="digitify-header__cta-icon" aria-hidden="true">
                      &rarr;
                    </span>
                  </a>
                </div>
                <button
                  className="digitify-menu-toggle"
                  type="button"
                  aria-label="Menu openen"
                  aria-expanded={mobileOpen}
                  aria-controls="digitify-mobile-nav"
                  onClick={() => setMobileOpen((value) => !value)}
                >
                  <span />
                  <span />
                  <span />
                </button>
              </div>
            </div>
          </div>
          <div className="digitify-header__progress" aria-hidden="true">
            <span />
          </div>
        </header>

        <div
          className={`digitify-mobile-nav digitify-mobile-nav--drawer${mobileOpen ? " is-open" : ""}`}
          id="digitify-mobile-nav"
          aria-hidden={mobileOpen ? "false" : "true"}
        >
          <div className="digitify-mobile-nav__overlay" onClick={closeMobile} role="presentation" />
          <div className="digitify-mobile-nav__panel" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="digitify-mobile-nav__head">
              <Link href="/product" className="digitify-mobile-nav__brand" aria-label="Digitify — Home" onClick={closeMobile}>
                <img
                  className="digitify-logo__img digitify-logo__img--brand"
                  src={logoSrc}
                  alt="Digitify"
                  width={120}
                  height={32}
                  loading="eager"
                  decoding="async"
                />
              </Link>
              <button className="digitify-mobile-nav__close" type="button" aria-label="Menu sluiten" onClick={closeMobile}>
                &times;
              </button>
            </div>
            <div className="digitify-mobile-nav__scroll">
              <nav className="digitify-mobile-nav__list" aria-label="Navigatie">
                <Link
                  href="/product"
                  className={mobileNavItemClass(activeKey === "lead-finder", "accent")}
                  onClick={closeMobile}
                >
                  Lead Finder
                </Link>
                <Link
                  href="/oplossingen"
                  className={mobileNavItemClass(activePage === "solutions", "accent")}
                  onClick={closeMobile}
                >
                  Oplossingen
                </Link>
                {status === "authenticated" ? (
                  <Link href="/dashboard" className={mobileNavItemClass(false, "accent")} onClick={closeMobile}>
                    Dashboard
                  </Link>
                ) : null}
                <div className="digitify-mobile-nav__divider" aria-hidden="true" />
                <a href={getWordPressPageUrl("home", urls)} className={mobileNavItemClass(false)} onClick={closeMobile}>
                  Home
                </a>
                <a href={getWordPressPageUrl("diensten", urls)} className={mobileNavItemClass(false)} onClick={closeMobile}>
                  Diensten
                </a>
                <a href={getWordPressPageUrl("cases", urls)} className={mobileNavItemClass(false)} onClick={closeMobile}>
                  Cases
                </a>
                <a
                  href={getWordPressPageUrl("over-ons", urls)}
                  className={mobileNavItemClass(activeKey === "over-ons")}
                  onClick={closeMobile}
                >
                  Over ons
                </a>
                <a href={`${urls.shop}/`} className={mobileNavItemClass(false, "accent")} onClick={closeMobile}>
                  Shop
                </a>
                <a href={`${urls.shop}/designer`} className={mobileNavItemClass(false, "accent")} onClick={closeMobile}>
                  Designer
                </a>
                <a
                  href={getWordPressPageUrl("contact", urls)}
                  className={mobileNavItemClass(activeKey === "contact")}
                  onClick={closeMobile}
                >
                  Contact
                </a>
              </nav>
              <div className="digitify-mobile-nav__account" aria-label="Account">
                {status === "authenticated" ? (
                  <button
                    type="button"
                    className={`${mobileNavItemClass(false)} digitify-mobile-nav__item--button`}
                    onClick={() => {
                      closeMobile();
                      void signOut({ callbackUrl: "/" });
                    }}
                  >
                    Uitloggen
                  </button>
                ) : (
                  <>
                    <div className="digitify-mobile-nav__divider" aria-hidden="true" />
                    <div className="digitify-mobile-nav__auth-actions">
                      <Link href="/login" className="digitify-mobile-nav__auth-btn" onClick={closeMobile}>
                        Inloggen
                      </Link>
                      <Link href="/register" className="digitify-mobile-nav__auth-btn digitify-mobile-nav__auth-btn--solid" onClick={closeMobile}>
                        Aanmelden
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="digitify-mobile-nav__footer">
              <a href={getWordPressPageUrl("contact", urls)} className="digitify-mobile-nav__cta" onClick={closeMobile}>
                Offerte aanvragen
              </a>
              <div className="digitify-mobile-nav__meta-links">
                <a href="mailto:contact@digitify.be" className="digitify-mobile-nav__footer-link" onClick={closeMobile}>
                  contact@digitify.be
                </a>
                <a
                  href={getWordPressPageUrl("home", urls)}
                  className="digitify-mobile-nav__footer-link digitify-mobile-nav__footer-link--accent"
                  onClick={closeMobile}
                >
                  digitify.be
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function DigitifyMarketingFooter() {
  const urls = getDigitifySiteUrls();
  const navItems = getUnifiedNavItems({ site: "leads" });
  const footerLogo = "/assets/branding/logo-header.png";
  const year = new Date().getFullYear();

  return (
    <footer className="digitify-footer digitify-footer--light-premium digitify-footer--atelier" role="contentinfo">
      <div className="digitify-footer__top-rail" aria-hidden="true">
        <span />
      </div>

      <div className="digitify-footer__closing">
        <div className="digitify-footer__cta digitify-footer__cta--band">
          <div className="digitify-footer__cta-accent-rail" aria-hidden="true">
            <span />
          </div>
          <div className="digitify-footer__cta-band">
            <div className="digitify-footer__cta-copy">
              <span className="digitify-footer__cta-eyebrow">Klaar om te groeien?</span>
              <h2>
                Start uw digitale project <span className="digitify-footer__cta-highlight">vandaag</span>
              </h2>
              <p>Vertel ons over uw plannen — wij reageren binnen 24 uur met concrete tips.</p>
            </div>
            <div className="digitify-footer__cta-actions digitify-footer__cta-actions--band">
              <a href={getWordPressPageUrl("contact", urls)} className="digitify-btn digitify-btn--primary digitify-footer__cta-primary">
                Offerte aanvragen
                <span className="digitify-footer__cta-primary-icon" aria-hidden="true">
                  &rarr;
                </span>
              </a>
              <p className="digitify-footer__cta-trust">24u reactie · Gratis kennismaking · Gent &amp; remote</p>
              <div className="digitify-footer__cta-quick">
                <a href="tel:+32486515773">
                  {icon("phone")} Bel ons
                </a>
                <a href="https://wa.me/32486515773" className="digitify-footer__cta-quick--wa" target="_blank" rel="noopener noreferrer">
                  {icon("whatsapp")} WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="digitify-footer__container">
        <div className="digitify-footer__studio">
          <div className="digitify-footer__studio-inner">
            <div className="digitify-footer__brand digitify-footer__brand-hero">
              <a href={getWordPressPageUrl("home", urls)} className="digitify-footer__logo-link" aria-label="Digitify — Home">
                <img className="digitify-footer__logo-main" src={footerLogo} alt="Digitify" width={200} height={56} loading="lazy" decoding="async" />
              </a>
              <p className="digitify-footer__tagline">
                <span>Partner in Digital Solutions</span>
              </p>
              <p className="digitify-footer__brand-note">Webdesign, media &amp; marketing voor groeiende merken.</p>
              <div className="digitify-footer__disciplines">
                <span>Webdesign</span>
                <span>Media</span>
                <span>Marketing</span>
              </div>
              <div className="digitify-footer__social">
                <a href="https://www.facebook.com/digitify.be" className="digitify-social-btn digitify-social-btn--facebook" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                  {icon("facebook")}
                </a>
                <a href="https://www.instagram.com/digitify.be/" className="digitify-social-btn digitify-social-btn--instagram" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                  {icon("instagram")}
                </a>
              </div>
            </div>

            <div className="digitify-footer__grid">
              <nav className="digitify-footer__col digitify-footer__col--nav" aria-label="Footer navigatie">
                <span className="digitify-footer__col-label">Navigatie</span>
                <ul className="digitify-footer__links digitify-footer__links--numbered">
                  {flattenNavItems(navItems).map((item) => (
                    <li key={item.key}>
                      {"external" in item && item.external ? (
                        <a href={item.href} className={"shopAccent" in item && item.shopAccent ? "digitify-footer__link--shop" : undefined}>
                          {item.label}
                        </a>
                      ) : (
                        <Link href={item.href} className={"shopAccent" in item && item.shopAccent ? "digitify-footer__link--shop" : undefined}>
                          {item.label}
                        </Link>
                      )}
                    </li>
                  ))}
                  <li>
                    <Link href="/oplossingen">Oplossingen</Link>
                  </li>
                </ul>
              </nav>

              <nav className="digitify-footer__col digitify-footer__col--services" aria-label="Footer diensten">
                <span className="digitify-footer__col-label">Expertise</span>
                <ul className="digitify-footer__links digitify-footer__links--numbered">
                  <li>
                    <a href={getWordPressPageUrl("webdesign", urls)}>Websites &amp; webshops</a>
                  </li>
                  <li>
                    <a href={getWordPressPageUrl("media", urls)}>Video &amp; content</a>
                  </li>
                  <li>
                    <a href={getWordPressPageUrl("marketing", urls)}>Ads &amp; campagnes</a>
                  </li>
                </ul>
              </nav>

              <div className="digitify-footer__col digitify-footer__col--contact">
                <span className="digitify-footer__col-label">Contact</span>
                <ul className="digitify-footer__links digitify-footer__links--contact">
                  <li>
                    {icon("map")}
                    <span>Boekweitstraat 7, 9000 Gent</span>
                  </li>
                  <li>
                    {icon("phone")}
                    <a href="tel:+32486515773">+32 486 51 57 73</a>
                  </li>
                  <li>
                    {icon("mail")}
                    <a href="mailto:contact@digitify.be">contact@digitify.be</a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="digitify-footer__ticker" aria-hidden="true">
          <div className="digitify-footer__ticker-track">
            <span>Webdesign</span>
            <span>Media</span>
            <span>Marketing</span>
            <span>Gent</span>
            <span>Digital Solutions</span>
            <span>Lead Finder</span>
            <span>Webdesign</span>
            <span>Media</span>
            <span>Marketing</span>
            <span>Gent</span>
            <span>Digital Solutions</span>
            <span>Lead Finder</span>
          </div>
        </div>

        <div className="digitify-footer__rail">
          <div className="digitify-footer__rail-accent" aria-hidden="true">
            <span />
          </div>
          <div className="digitify-footer__rail-inner">
            <p className="digitify-footer__copyright">
              &copy; {year} Digitify
              <span className="digitify-footer__bar-dot" aria-hidden="true">
                &middot;
              </span>
              BE0685.556.507
            </p>
            <nav className="digitify-footer__legal" aria-label="Juridische links">
              <a href={getWordPressPageUrl("algemene-voorwaarden", urls)}>Algemene Voorwaarden</a>
              <a href={getWordPressPageUrl("cookiebeleid", urls)}>Cookiebeleid</a>
              <a href={getWordPressPageUrl("privacyverklaring", urls)}>Privacyverklaring</a>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function DigitifyMarketingShell({
  activePage,
  children,
}: {
  activePage: MarketingPageKey;
  children: ReactNode;
}) {
  return (
    <>
      <DigitifyMarketingHeader activePage={activePage} />
      <div className="digitify-page-content">{children}</div>
      <DigitifyMarketingFooter />
      <DigitifyChatbotLoader />
    </>
  );
}
