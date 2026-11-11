import { SiteFooter, SiteHeader } from "../../components/Chrome.jsx";
import LiveScore from "./LiveScore.jsx";
import "./live-score.css";

export const metadata = { title: "Live score", description: "The webcam watches the room; Eno-style loops follow where people are and how much they move (from mk-audio-editing, Bok to the Future, Oct 22)." };

export default function Page() {
  return (
    <>
      <SiteHeader current="launch" />
      <LiveScore />
      <SiteFooter />
    </>
  );
}
