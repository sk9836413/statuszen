import { BrandStyle } from "@/components/site/brand-style";

/** Applies the page's theme (light / dark / follow the visitor's system) before paint, plus its accent colour. */
export function StatusTheme({ theme, accent }: { theme: "light" | "dark" | "auto"; accent: string }) {
  const code = `(function(){try{var t=${JSON.stringify(theme)},e=document.documentElement,m=matchMedia("(prefers-color-scheme: dark)");function a(){var d=t==="dark"||(t==="auto"&&m.matches);e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light";}a();if(t==="auto"&&m.addEventListener)m.addEventListener("change",a);}catch(x){}})();`;
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: code }} />
      <BrandStyle color={accent} />
    </>
  );
}
