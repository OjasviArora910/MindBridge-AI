// SOS exercise content. Pure data: these work with no network and no LLM.
export interface Step {
  title: string;
  text: string;
  seconds: number;
  phase?: "in" | "hold" | "out"; // breathing animation cue
}
export interface Exercise {
  id: "breathing" | "grounding" | "pmr" | "stop";
  title: string;
  blurb: string;
  minutes: string;
  steps: Step[];
  caution?: string;
}

function breathingSteps(cycles: number): Step[] {
  const out: Step[] = [];
  for (let i = 1; i <= cycles; i++) {
    out.push({ title: "Breathe in", text: "Slowly through your nose.", seconds: 4, phase: "in" });
    out.push({ title: "Hold gently", text: "Keep your shoulders soft.", seconds: 2, phase: "hold" });
    out.push({ title: "Breathe out", text: "Slowly, like fogging a mirror.", seconds: 6, phase: "out" });
  }
  return out;
}

const pmrGroups: [string, string][] = [
  ["hands", "Make fists with both hands."],
  ["arms", "Bend your elbows and tighten your upper arms."],
  ["shoulders", "Lift your shoulders toward your ears."],
  ["face", "Scrunch your face, eyes and jaw gently."],
  ["stomach", "Tighten your stomach muscles."],
  ["legs", "Press your thighs together and tighten your legs."],
  ["feet", "Curl your toes."],
];

export const exercises: Exercise[] = [
  {
    id: "breathing",
    title: "Paced breathing",
    blurb: "A slow in-and-out rhythm to settle your body.",
    minutes: "About 1 minute",
    steps: breathingSteps(5),
    caution: "If breathing slowly feels uncomfortable or makes you dizzy, stop and breathe normally.",
  },
  {
    id: "grounding",
    title: "5-4-3-2-1 grounding",
    blurb: "Use your senses to come back to the room you're in.",
    minutes: "About 2 minutes",
    steps: [
      { title: "5 things you can see", text: "Look around slowly and name five things you can see.", seconds: 30 },
      { title: "4 things you can feel", text: "Notice four things you can touch or feel: your feet on the floor, fabric, the chair.", seconds: 30 },
      { title: "3 things you can hear", text: "Listen for three sounds, near or far.", seconds: 25 },
      { title: "2 things you can smell", text: "Notice two scents. If you can't smell much, recall two scents you like.", seconds: 20 },
      { title: "1 thing you can taste", text: "Notice one taste, or take a slow sip of water.", seconds: 15 },
    ],
  },
  {
    id: "pmr",
    title: "Progressive muscle relaxation",
    blurb: "Tense and release muscle groups, one at a time.",
    minutes: "About 3 minutes",
    caution: "Skip any area that is painful, injured or uncomfortable. Tense gently, never to the point of pain.",
    steps: pmrGroups.flatMap(([name, how]) => [
      { title: `Tense your ${name}`, text: `${how} Hold for a few seconds.`, seconds: 5 },
      { title: `Release your ${name}`, text: "Let go completely. Notice the difference.", seconds: 10 },
    ]),
  },
  {
    id: "stop",
    title: "STOP: pause and reflect",
    blurb: "Four small steps to pause before reacting.",
    minutes: "About 2 minutes",
    steps: [
      { title: "S: Stop", text: "Pause what you're doing. Let your hands rest.", seconds: 15 },
      { title: "T: Take a breath", text: "Take a few slow breaths, in through the nose and out through the mouth.", seconds: 25 },
      { title: "O: Observe", text: "What are you thinking and feeling right now? What's happening in your body? Just notice, without judging.", seconds: 40 },
      { title: "P: Proceed", text: "Choose one small next step that would help. It can be tiny. It can also be rest.", seconds: 30 },
    ],
  },
];
