import { SiteHeader } from "../../../components/Chrome.jsx";
import Splash from "./Splash.jsx";
import "../../../../lib/cv/cv.css";

export const metadata = { title: "Effects: splash", description: "A fluid simulation you stir with the mouse or your hand." };

export default function SplashPage() {
  return (
    <>
      <SiteHeader current="track" />
      <main id="main">
        <Splash />
      </main>
    </>
  );
}
