// The experiment on its own, with its original styles (src/globals.css). /track/fellows/gesture-camera shows it in a frame.
import GestureCamera from "../src/GestureCamera.jsx";
import "../src/globals.css";

export const metadata = { title: "Gesture Camera" };

export default function Page() {
  return <GestureCamera />;
}
