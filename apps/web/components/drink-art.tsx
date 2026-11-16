/**
 * Hình minh họa ly đồ uống tự vẽ bằng SVG (không dùng ảnh ngoài), màu theo loại món.
 * Dùng cho thẻ món, trang chi tiết, bảng công thức. Có aria-label để trình đọc màn hình đọc được tên món.
 */
type Palette = { bg: string; drink: string; foam: string; accent: string };

const PALETTES: Array<{ match: RegExp; palette: Palette }> = [
  { match: /matcha/i, palette: { bg: "#E4EDDA", drink: "#7FA35B", foam: "#E8F0DC", accent: "#4F6E35" } },
  { match: /bạc xỉu|sữa/i, palette: { bg: "#F1E6D6", drink: "#C99A6B", foam: "#F5E9D8", accent: "#8A5A35" } },
  { match: /đen/i, palette: { bg: "#E9DED2", drink: "#3B2618", foam: "#6B4A33", accent: "#2A1A10" } },
  { match: /trà sữa|trân châu/i, palette: { bg: "#F0E2D2", drink: "#C49A74", foam: "#EBDCCB", accent: "#3A2A20" } },
  { match: /trà/i, palette: { bg: "#F4E3CF", drink: "#B5652B", foam: "#E9C59F", accent: "#7A3E15" } },
];
const DEFAULT: Palette = { bg: "#EDE4D6", drink: "#8C5A35", foam: "#E7D3BB", accent: "#5A3820" };

export function paletteFor(name: string, category = ""): Palette {
  const text = `${name} ${category}`;
  return PALETTES.find((p) => p.match.test(text))?.palette ?? DEFAULT;
}

export function DrinkArt({ name, category = "", className = "" }: { name: string; category?: string; className?: string }) {
  const p = paletteFor(name, category);
  const pearls = /trân châu|trà sữa/i.test(`${name} ${category}`);
  const iced = !/nóng/i.test(name);
  return (
    <svg viewBox="0 0 200 150" role="img" aria-label={`Hình minh họa ${name}`} className={className} preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="150" fill={p.bg} />
      <circle cx="160" cy="28" r="34" fill="#ffffff" opacity="0.35" />
      <circle cx="30" cy="130" r="40" fill="#ffffff" opacity="0.25" />
      {/* ống hút */}
      <rect x="108" y="10" width="7" height="60" rx="3" transform="rotate(14 111 40)" fill={p.accent} opacity="0.85" />
      {/* ly */}
      <path d="M68 38 H132 L124 132 Q123 140 115 140 H85 Q77 140 76 132 Z" fill="#ffffff" opacity="0.55" />
      <path d="M71 62 H129 L123 130 Q122 136 115 136 H85 Q78 136 77 130 Z" fill={p.drink} />
      <path d="M71 62 H129 L128 72 H72 Z" fill={p.foam} opacity="0.9" />
      {iced && (
        <g fill="#ffffff" opacity="0.5">
          <rect x="82" y="76" width="14" height="14" rx="3" transform="rotate(-12 89 83)" />
          <rect x="102" y="82" width="13" height="13" rx="3" transform="rotate(10 108 88)" />
        </g>
      )}
      {pearls && (
        <g fill={p.accent}>
          {[[86, 124], [96, 128], [106, 124], [116, 127], [91, 116], [111, 117], [101, 118]].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="4.2" />
          ))}
        </g>
      )}
      <path d="M68 38 H132 L124 132 Q123 140 115 140 H85 Q77 140 76 132 Z" fill="none" stroke={p.accent} strokeOpacity="0.35" strokeWidth="2" />
      <rect x="64" y="34" width="72" height="7" rx="3.5" fill={p.accent} opacity="0.75" />
    </svg>
  );
}
