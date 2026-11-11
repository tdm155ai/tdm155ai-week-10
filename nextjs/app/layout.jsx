import "@fontsource-variable/inter";
import "./globals.css";

export const metadata = {
  title: { default: "Installations · TDM 155AI week 10", template: "%s · TDM 155AI week 10" },
  description: "TDM 155AI week 10: Installations. Launching media with buttons, keys, MIDI, voice and lyric cues, and computer vision, for a live performance in the studio.",
};

export const viewport = {
  colorScheme: "dark",
  themeColor: "#121412",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
