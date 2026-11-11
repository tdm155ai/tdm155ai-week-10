import { SiteHeader } from "../../components/Chrome.jsx";
import Hello from "./Hello.jsx";
import "../../../lib/cv/cv.css";

export const metadata = { title: "Draw a box: hello in one file" };

export default function DrawABoxHelloPage() {
  return (
    <>
      <SiteHeader current="draw" />
      <main id="main">
        <Hello />
      </main>
    </>
  );
}
