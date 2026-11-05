import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
  ...p,
});

export const IconCalendar = (p: P) => (
  <svg {...base(p)}><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>
);
export const IconPeople = (p: P) => (
  <svg {...base(p)}><circle cx="9" cy="8.5" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><circle cx="17" cy="9" r="2.6" /><path d="M16.5 14.6c2.6.1 4.4 1.8 5 4.4" /></svg>
);
export const IconChart = (p: P) => (
  <svg {...base(p)}><path d="M4 20V11M10 20V5M16 20v-7M21 20H3" /><path d="M16 13v7" /></svg>
);
export const IconMore = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><circle cx="7.6" cy="12" r=".9" fill="currentColor" /><circle cx="12" cy="12" r=".9" fill="currentColor" /><circle cx="16.4" cy="12" r=".9" fill="currentColor" /></svg>
);
export const IconPlus = (p: P) => (
  <svg {...base(p)} strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconChevronLeft = (p: P) => (
  <svg {...base(p)} strokeWidth={2.4}><path d="M15 5l-7 7 7 7" /></svg>
);
export const IconChevronRight = (p: P) => (
  <svg {...base(p)} strokeWidth={2.4}><path d="M9 5l7 7-7 7" /></svg>
);
export const RowChevron = () => (
  <svg className="row-chevron" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1.5 1.5L6.5 7l-5 5.5" />
  </svg>
);
export const IconSearch = (p: P) => (
  <svg {...base(p)} strokeWidth={2.2}><circle cx="10.5" cy="10.5" r="6.5" /><path d="M20 20l-4.8-4.8" /></svg>
);
export const IconPhone = (p: P) => (
  <svg {...base(p)}><path d="M5 3.5h3.2l1.6 4.2-2.1 1.4a11 11 0 0 0 5.2 5.2l1.4-2.1 4.2 1.6V17a3 3 0 0 1-3 3A15.5 15.5 0 0 1 2 6.5a3 3 0 0 1 3-3z" /></svg>
);
export const IconChat = (p: P) => (
  <svg {...base(p)}><path d="M20.5 11.5a8.5 8.5 0 0 1-12.6 7.4L3.5 20l1.2-4.2a8.5 8.5 0 1 1 15.8-4.3z" /></svg>
);
export const IconSms = (p: P) => (
  <svg {...base(p)}><path d="M4 5h16a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 20 17H9l-5 3.5V6.5A1.5 1.5 0 0 1 5.5 5" /></svg>
);
export const IconCalendarPlus = (p: P) => (
  <svg {...base(p)}><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4M12 13v5M9.5 15.5h5" /></svg>
);
export const IconCheck = (p: P) => (
  <svg {...base(p)} strokeWidth={2.6}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
export const IconWarning = (p: P) => (
  <svg {...base(p)}><path d="M12 3.5l9.5 16.5h-19z" /><path d="M12 10v4.5M12 17.4v.1" /></svg>
);
export const IconScissors = (p: P) => (
  <svg {...base(p)}><circle cx="6" cy="6.5" r="3" /><circle cx="6" cy="17.5" r="3" /><path d="M8.4 8.3L20 18M8.4 15.7L20 6" /></svg>
);
export const IconTrash = (p: P) => (
  <svg {...base(p)}><path d="M4 6.5h16M9.5 6.5V4.5h5v2M6 6.5l1 13.5h10l1-13.5M10 10.5v6M14 10.5v6" /></svg>
);
export const IconClock = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
);
export const IconCake = (p: P) => (
  <svg {...base(p)}><path d="M4 20.5h16M5 20.5v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7M5 15.5c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 5 0M12 11.5V8M12 5.5c-.8-.8-.8-1.6 0-2.5.8.9.8 1.7 0 2.5z" /></svg>
);
export const IconShare = (p: P) => (
  <svg {...base(p)}><path d="M12 15V3.5M8 7.5l4-4 4 4M7 10.5H5.5v10h13v-10H17" /></svg>
);
export const IconDownload = (p: P) => (
  <svg {...base(p)}><path d="M12 4v11M8 11l4 4 4-4M5 20h14" /></svg>
);
export const IconGear = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
);
export const IconList = (p: P) => (
  <svg {...base(p)}><path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.1M4.5 12h.1M4.5 17.5h.1" strokeWidth={2.2} /></svg>
);
export const IconEuro = (p: P) => (
  <svg {...base(p)}><path d="M17.5 6.5A6.5 6.5 0 1 0 17.5 17.5M4 10.5h9M4 13.5h9" /></svg>
);
export const IconArchive = (p: P) => (
  <svg {...base(p)}><rect x="3" y="4" width="18" height="4.5" rx="1" /><path d="M5 8.5v11h14v-11M10 12.5h4" /></svg>
);
export const IconUndo = (p: P) => (
  <svg {...base(p)}><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
);
export const IconPencil = (p: P) => (
  <svg {...base(p)}><path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z" /><path d="M14.5 6.5l3 3" /></svg>
);
export const IconX = (p: P) => (
  <svg {...base(p)} strokeWidth={2.2}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IconUserX = (p: P) => (
  <svg {...base(p)}><circle cx="10" cy="8" r="3.5" /><path d="M3.5 20c.6-3.6 3.2-5.5 6.5-5.5 1.3 0 2.5.3 3.5.8M16.5 15.5l4 4M20.5 15.5l-4 4" /></svg>
);
export const IconDatabase = (p: P) => (
  <svg {...base(p)}><ellipse cx="12" cy="5.5" rx="7.5" ry="2.5" /><path d="M4.5 5.5v13c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-13M4.5 12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5" /></svg>
);
export const IconCart = (p: P) => (
  <svg {...base(p)}><path d="M3 4h2.5l2.2 11h10.6l2-7.5H6.5" /><circle cx="9" cy="19.5" r="1.4" /><circle cx="17" cy="19.5" r="1.4" /></svg>
);
