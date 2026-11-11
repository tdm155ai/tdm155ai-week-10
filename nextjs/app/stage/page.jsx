import Stage from "../../lib/stage/Stage.jsx";
import "../../lib/stage/stage.css";

export const metadata = { title: "Stage" };

// The output window: open it, drag it to the projector, click once, press F. Cues come from other tabs.
export default function StagePage() {
  return <Stage />;
}
