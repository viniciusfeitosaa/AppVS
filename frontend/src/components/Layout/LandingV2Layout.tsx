import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600;6..72,700&family=Manrope:wght@400;500;600;700&display=swap';
const MATERIAL_HREF =
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap';

export default function LandingV2Layout() {
  useEffect(() => {
    const specs = [
      { id: 'landing-v2-fonts', href: FONT_HREF },
      { id: 'landing-v2-material', href: MATERIAL_HREF },
    ];
    const appended: HTMLLinkElement[] = [];
    for (const { id, href } of specs) {
      if (document.getElementById(id)) continue;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.id = id;
      document.head.appendChild(link);
      appended.push(link);
    }
    return () => {
      appended.forEach((el) => el.remove());
    };
  }, []);

  return (
    <div className="landing-v2-root min-h-dvh bg-background font-body-md text-on-surface antialiased">
      <Outlet />
    </div>
  );
}
