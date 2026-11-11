import { SiteHeader } from "../components/Chrome.jsx";
import DrawABox from "./DrawABox.jsx";
import "../../lib/cv/cv.css";

export const metadata = { title: "Draw a box" };

export default function DrawABoxPage() {
  return (
    <>
      <SiteHeader current="draw" />
      <main id="main">
        <DrawABox />
      </main>
    </>
  );
}
