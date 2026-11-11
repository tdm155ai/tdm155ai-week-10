import { SiteHeader } from "../../../components/Chrome.jsx";
import Ghost from "./Ghost.jsx";
import "../../../../lib/cv/cv.css";

export const metadata = { title: "Effects: ghost", description: "A glowing cloud that trails the mouse, your hand, or your head." };

export default function GhostPage() {
  return (
    <>
      <SiteHeader current="track" />
      <main id="main">
        <Ghost />
      </main>
    </>
  );
}
