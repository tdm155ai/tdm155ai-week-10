import Frame from "../Frame.jsx";
import { fellows } from "../fellows.js";

const fellow = fellows.find((f) => f.slug === "hand-drums");
export const metadata = { title: `Fellows: ${fellow.title}` };

export default function Page() {
  return <Frame fellow={fellow} />;
}
