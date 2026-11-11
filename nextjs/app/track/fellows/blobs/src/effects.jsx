"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import GhostCursor from "./react-bits/GhostCursor.jsx";
import SplashCursor from "./react-bits/SplashCursor.jsx";
const BLACK = { r: 0, g: 0, b: 0 };
import { COLORS } from "./colors.js";
const subscribe = () => () => { };
const layer = { position: "absolute", inset: 0, mixBlendMode: "screen" };
// Class app (Nov 11, Marlon: the splash was too heavy and got glitchy): ONE splash follows both hands (each in its
// color) instead of one splash per hand, at a lower resolution, and it starts fresh every RESET_SECONDS (or on the
// Reset button). Starting fresh remounts only the splash; the head trail and the tracking keep going.
export const RESET_SECONDS = 45;
const SPLASH = { SIM_RESOLUTION: 64, DYE_RESOLUTION: 512, PRESSURE_ITERATIONS: 10 };
/** Ghost trail for the head, one fluid splash for both hands, all additive on black. */
export default function BlobEffects({ trackers, resetSignal = 0, onReset }) {
    // The shaders are canvas-only and use Math.random, so render them after mount, never during prerender.
    const mounted = useSyncExternalStore(subscribe, () => true, () => false);
    const [generation, setGeneration] = useState(0);
    // Both hands as one list for the one splash; each tracker says its color.
    const hands = useMemo(() => ({
        get current() {
            const left = trackers.leftHand.current[0];
            const right = trackers.rightHand.current[0];
            left.color = COLORS.leftHand;
            right.color = COLORS.rightHand;
            return [left, right];
        },
    }), [trackers]);
    // Start the splash fresh on a timer, and whenever the Reset button bumps resetSignal.
    useEffect(() => {
        const timer = setInterval(() => setGeneration((g) => g + 1), RESET_SECONDS * 1000);
        return () => clearInterval(timer);
    }, [resetSignal]);
    useEffect(() => { if (resetSignal) setGeneration((g) => g + 1); }, [resetSignal]);
    useEffect(() => { onReset?.(generation); }, [generation, onReset]);
    if (!mounted)
        return <div style={{ position: "absolute", inset: 0, background: "#000" }}/>;
    return (<div style={{ position: "absolute", inset: 0, background: "#000", overflow: "hidden" }}>
      <GhostCursor tracker={trackers.head} color={COLORS.head} mixBlendMode="normal" maxDevicePixelRatio={1} trailLength={50} inertia={0.5} bloomStrength={0.25} zIndex={0}/>
      <div style={layer} key={generation}>
        <SplashCursor trackers={hands} COLOR={COLORS.leftHand} RAINBOW_MODE={false} BACK_COLOR={BLACK} TRANSPARENT={false} {...SPLASH} DENSITY_DISSIPATION={2.5} VELOCITY_DISSIPATION={1.5} SPLAT_RADIUS={0.25} SPLAT_FORCE={6000}/>
      </div>
    </div>);
}
