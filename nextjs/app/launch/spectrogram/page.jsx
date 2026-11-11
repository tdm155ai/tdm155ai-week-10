import SpectrogramShell from "../../../lib/launch/spectrogram/SpectrogramShell.jsx";

export const metadata = { title: "Spectrogram", description: "Chrome Music Lab's spectrogram (Google Creative Lab, Apache 2.0)." };

// Full window, like the original: the spectrogram covers the page (see lib/launch/spectrogram/).
export default function SpectrogramPage() {
  return <SpectrogramShell />;
}
