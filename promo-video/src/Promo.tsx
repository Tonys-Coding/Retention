import {AbsoluteFill, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

const FONT = 'Helvetica Neue, Arial, sans-serif';
const SCENE = 90; // 3s per scene

type Scene = {title: string; sub: string; img: string};
const SCENES: Scene[] = [
  {title: 'Study smarter.', sub: 'AI flashcards. Minimalist focus.', img: '0_Promo_Marquee.jpg'},
  {title: 'PDFs → Flashcards', sub: 'Pick a file from Google Drive. AI does the rest.', img: '2_PDFs_to_Flashcards.jpg'},
  {title: 'Infinite organization', sub: 'Decks, folders and tags, your way.', img: '1_Infinite_Organization.jpg'},
  {title: 'Interactive study modes', sub: 'Flip, quiz and review at your pace.', img: '3_Interactive_Study_Modes.jpg'},
  {title: 'Secure cloud sync', sub: 'Your cards, on every device.', img: '4_Secure_Cloud_Sync.jpg'},
];
const OUTRO = 90;
export const TOTAL_FRAMES = SCENES.length * SCENE + OUTRO;

const SceneView = ({scene, vertical}: {scene: Scene; vertical: boolean}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame: f, fps, config: {damping: 14}});
  const out = interpolate(f, [SCENE - 10, SCENE], [1, 0], {extrapolateLeft: 'clamp'});
  const slide = interpolate(pop, [0, 1], [80, 0]);
  return (
    <AbsoluteFill style={{background: '#fff', opacity: out, fontFamily: FONT, alignItems: 'center', justifyContent: 'center', flexDirection: vertical ? 'column' : 'row', gap: 60, padding: 80}}>
      <div style={{transform: `translateY(${slide}px)`, opacity: pop, textAlign: vertical ? 'center' : 'left', maxWidth: vertical ? 900 : 760}}>
        <div style={{fontSize: vertical ? 110 : 96, fontWeight: 900, lineHeight: 1.05, color: '#000'}}>{scene.title}</div>
        <div style={{fontSize: 44, marginTop: 24, color: '#333'}}>{scene.sub}</div>
      </div>
      <Img src={staticFile(scene.img)} style={{width: vertical ? 900 : 860, border: '6px solid #000', boxShadow: '16px 16px 0 #000', transform: `scale(${interpolate(pop, [0, 1], [0.9, 1])})`}} />
    </AbsoluteFill>
  );
};

const Outro = ({vertical}: {vertical: boolean}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame: f, fps});
  return (
    <AbsoluteFill style={{background: '#000', color: '#fff', fontFamily: FONT, alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 30}}>
      <Img src={staticFile('icon128.png')} style={{width: 200, height: 200, borderRadius: 32, transform: `scale(${pop})`}} />
      <div style={{fontSize: vertical ? 120 : 130, fontWeight: 900, opacity: pop}}>Retention</div>
      <div style={{fontSize: 48, opacity: pop}}>AI Flashcards. Get it on the Chrome Web Store.</div>
    </AbsoluteFill>
  );
};

export const Promo = ({vertical}: {vertical: boolean}) => (
  <AbsoluteFill style={{background: '#fff'}}>
    {SCENES.map((s, i) => (
      <Sequence key={s.title} from={i * SCENE} durationInFrames={SCENE}>
        <SceneView scene={s} vertical={vertical} />
      </Sequence>
    ))}
    <Sequence from={SCENES.length * SCENE} durationInFrames={OUTRO}>
      <Outro vertical={vertical} />
    </Sequence>
  </AbsoluteFill>
);
