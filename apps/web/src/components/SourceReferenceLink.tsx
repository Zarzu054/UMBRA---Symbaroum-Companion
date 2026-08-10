import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type ReferenceContentProps = {
  source: string;
  page?: number | null;
  eyebrow?: string;
};

type SourceReferenceLinkProps = ReferenceContentProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "href"> & {
    href: string;
    ariaLabel?: string;
  };

type SourceReferenceButtonProps = ReferenceContentProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "type"> & {
    ariaLabel?: string;
  };

function ReferenceContent({ source, page, eyebrow = "Fuente" }: ReferenceContentProps): ReactNode {
  return (
    <>
      <span className="source-reference-link__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M6.5 4.5h8.25A2.75 2.75 0 0 1 17.5 7.25V19H8.25A2.75 2.75 0 0 1 5.5 16.25V5.5a1 1 0 0 1 1-1Z" />
          <path d="M8.25 16.5h9.25M8.5 8h5.75M8.5 11h5.75" />
        </svg>
      </span>
      <span className="source-reference-link__copy">
        <small>{eyebrow}</small>
        <strong>{source}</strong>
      </span>
      {page ? <span className="source-reference-link__page">p.{page}</span> : null}
      <span className="source-reference-link__arrow" aria-hidden="true">↗</span>
    </>
  );
}

function accessibleLabel(source: string, page?: number | null): string {
  return page ? `${source} · p.${page}` : source;
}

export function SourceReferenceLink({ href, source, page, eyebrow, ariaLabel, className = "", target = "_blank", rel = "noreferrer", ...props }: SourceReferenceLinkProps) {
  return (
    <a
      {...props}
      className={`source-reference-link ${className}`.trim()}
      href={href}
      target={target}
      rel={rel}
      aria-label={ariaLabel ?? accessibleLabel(source, page)}
    >
      <ReferenceContent source={source} page={page} eyebrow={eyebrow} />
    </a>
  );
}

export function SourceReferenceButton({ source, page, eyebrow, ariaLabel, className = "", ...props }: SourceReferenceButtonProps) {
  return (
    <button
      {...props}
      type="button"
      className={`source-reference-link ${className}`.trim()}
      aria-label={ariaLabel ?? accessibleLabel(source, page)}
    >
      <ReferenceContent source={source} page={page} eyebrow={eyebrow} />
    </button>
  );
}
