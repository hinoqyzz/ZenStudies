interface SymbolMarkProps {
  size?: number;
  light?: string;
  violet?: string;
  core?: string;
  coreStroke?: string;
  title?: string;
  className?: string;
}

export function SymbolMark({
  size = 36,
  light = "#F5F6F0",
  violet = "#6558E8",
  core = "#73D8B2",
  coreStroke = "#101C1A",
  title,
  className,
}: SymbolMarkProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 128 128" role={title ? "img" : "presentation"} aria-label={title} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <rect x="14" y="14" width="68" height="68" rx="23" fill="none" stroke={light} strokeWidth="12" />
      <rect x="46" y="46" width="68" height="68" rx="23" fill="none" stroke={violet} strokeWidth="12" />
      <rect x="45" y="45" width="38" height="38" rx="12" fill={core} stroke={coreStroke} strokeWidth="6" />
    </svg>
  );
}

export function MintCore({ size = 18 }: { size?: number }) {
  return <span className="mint-core" style={{ width: size, height: size }} aria-hidden="true" />;
}
