// The experiment on its own, with its original styles (src/globals.css). /track/fellows/finger-sounds shows it in a frame.
import FingerSounds from "../src/FingerSounds.jsx";
import "../src/globals.css";

export const metadata = { title: "Finger Sounds" };

export default function Page() {
  return <FingerSounds />;
}
