import type { ReactNode } from "react";

/** Simple line icons (24x24, stroke only). Decorative: always aria-hidden. */
function Icon({ children, size = 22 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>
  );
}

export const HomeIcon = () => <Icon><path d="M4 11l8-7 8 7" /><path d="M6 10v9h12v-9" /></Icon>;
export const ChatIcon = () => <Icon><path d="M20 12a8 8 0 01-11.6 7.1L4 20l1-4A8 8 0 1120 12z" /></Icon>;
export const MoodIcon = () => <Icon><circle cx="12" cy="12" r="8" /><path d="M9 14c.8 1 1.8 1.5 3 1.5s2.2-.5 3-1.5" /><path d="M9.5 10h.01M14.5 10h.01" /></Icon>;
export const DiaryIcon = () => <Icon><path d="M6 4h11a1 1 0 011 1v14a1 1 0 01-1 1H6z" /><path d="M9 8h6M9 12h6M9 16h3" /></Icon>;
export const SosIcon = () => <Icon><path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" /></Icon>;
export const ChartIcon = () => <Icon><path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 15l3-4 3 2 4-6" /></Icon>;
export const SettingsIcon = () => <Icon><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></Icon>;
export const LifeIcon = () => <Icon><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M6.3 6.3l3.6 3.6M14.1 14.1l3.6 3.6M17.7 6.3l-3.6 3.6M9.9 14.1l-3.6 3.6" /></Icon>;
export const MicIcon = () => <Icon><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0013 0" /><path d="M12 17.5V21" /></Icon>;

/** Simple abstract bridge: two banks joined by an arch. Not a person, not a clinician. */
export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="38" height="38" rx="11" fill="#EAF2EC" />
      <path d="M6 27c4-11 24-11 28 0" stroke="#35566F" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M6 27h28" stroke="#8FB8D8" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M13 26v-4M20 26v-6M27 26v-4" stroke="#A8BFA8" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
