"use client";
import { useEffect, useRef } from "react";
import { EMPTY } from "./shared.js";
const SMOOTHING = 0.35;
const STALE_MS = 400;
const tracker = () => ({ x: 0.5, y: 0.5, active: false });
function follow(t, target, fresh) {
    if (!target || !fresh) {
        t.active = false;
        return;
    }
    if (!t.active) {
        t.x = target.x;
        t.y = target.y;
        t.active = true;
    }
    else {
        t.x += (target.x - t.x) * SMOOTHING;
        t.y += (target.y - t.y) * SMOOTHING;
    }
}
/** Smooths raw tracking positions into refs the shaders poll every frame. */
export function useTrackers(feed, onLive) {
    const head = useRef(tracker());
    const leftHand = useRef([tracker()]);
    const rightHand = useRef([tracker()]);
    const onLiveRef = useRef(onLive);
    useEffect(() => {
        onLiveRef.current = onLive;
    });
    useEffect(() => {
        let raf = 0;
        let wasLive = null;
        const tick = () => {
            raf = requestAnimationFrame(tick);
            const { msg, at } = feed.current;
            const fresh = performance.now() - at < STALE_MS;
            follow(head.current, msg.head, fresh);
            follow(leftHand.current[0], msg.hands[0], fresh);
            follow(rightHand.current[0], msg.hands[1], fresh);
            if (fresh !== wasLive) {
                wasLive = fresh;
                onLiveRef.current?.(fresh);
            }
        };
        tick();
        return () => cancelAnimationFrame(raf);
    }, [feed]);
    return { head, leftHand, rightHand };
}
export const emptyFeed = () => ({ msg: EMPTY, at: 0 });
