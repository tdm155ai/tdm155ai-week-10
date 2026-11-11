import "@fontsource-variable/inter";
import "./globals.css";

export const metadata = {
  title: { default: "Installations and Live Events · TDM 155AI week 10", template: "%s · TDM 155AI week 10" },
  description: "Start with buttons, keys, MIDI, a spoken word, and a raised hand. Combine cues on a shared stage for a short live performance. TDM 155AI, November 11, 2026.",
};

export const viewport = {
  colorScheme: "dark",
  themeColor: "#121412",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
