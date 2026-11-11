// The monologue for /track/horror: about a minute, for someone who is terrified, said into the filtered mic.
// The operator presses → (or Next line) as each line starts; that line's `do` happens at the same moment.
//   do: { voice, mask, scare, blackout, glitch, flare, ambience }
//   voice: a name from `voices` in ./settings.js; mask: a name from ./masks.js or "none";
//   scare: "heartbeat", "whispers", "stinger", or "boom"; blackout / glitch / flare: true; ambience: 0–1
// Written for this class (TDM 155AI); change it freely.

export const title = "Is somebody there?";

export const lines = [
  { say: "Hello? … Is somebody there?", do: { voice: "my own voice", mask: "none", ambience: 0.25 }, note: "quiet, peering into the dark" },
  { say: "I heard you. I know I heard you.", do: {} },
  { say: "Okay. Okay. It's an old house. Old houses make noises. That's all it is.", do: {}, note: "trying to laugh it off" },
  { say: "…No. That wasn't the house. That was my name. Something just said my name.", do: { scare: "heartbeat", ambience: 0.45 } },
  { say: "Why does my voice sound like that? That's not — that's not how I sound.", do: { voice: "ghost", scare: "whispers" }, note: "hands to your throat" },
  { say: "There's something behind me. Don't turn around. If I don't look at it, it can't —", do: { flare: true }, note: "the ghost passes behind you" },
  { say: "It's so cold. Why is it so cold? I can see my breath.", do: { glitch: true } },
  { say: "Please. I'm sorry. I didn't mean to come in here. I'll go. I'll go right now, I swear.", do: { ambience: 0.6 }, note: "begging, faster" },
  { say: "The door. Where's the door? It was right here. It was right here!", do: { scare: "heartbeat" } },
  { say: "It's in the mirror. It's wearing my face. It's smiling with my face.", do: { scare: "stinger", blackout: true, mask: "pale ghost" }, note: "look at the screen" },
  { say: "It's not behind me anymore.", do: { voice: "possessed" }, note: "slowly, very still" },
  { say: "… It's inside.", do: { glitch: true }, note: "a whisper" },
  { say: "It's using my voice. Can you hear it? That isn't me talking. That isn't me —", do: { voice: "demon", scare: "boom", ambience: 0.8 }, note: "cut off" },
  { say: "(silence)", do: { blackout: true, ambience: 0 } },
];
