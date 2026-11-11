// /track and /draw-a-box fire cues through the shared stage contract (TR's lib/stage/stage.js; read its comments
// for the cue kinds). This file only re-exports it, so the CV routes have one place to change if the contract moves.
export { fireCue, setParam, panic, openStage, onStage, pingStage } from "../stage/stage.js";
