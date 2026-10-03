import {AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const FPS = 30;
const s = (sec: number) => Math.round(sec * FPS);

type Clip = {src: string; from: number; to: number; rate: number};
type Scene = {kind: 'clip'; kicker: string; title: string; sub: string; clip: Clip} | {kind: 'themes'; kicker: string; title: string; sub: string; clip: Clip};

const dur = (c: Clip) => s((c.to - c.from) / c.rate);

const SCENES: Scene[] = [
  {kind: 'clip', kicker: '01 · AI', title: 'Any PDF into flashcards.', sub: 'Pick a file from Google Drive. AI writes the deck while you wait.', clip: {src: 'ai.mp4', from: 0.8, to: 8.8, rate: 1.25}},
  {kind: 'clip', kicker: '02 · Flashcards', title: 'Flip. Rate. Repeat.', sub: 'Spaced repetition surfaces the cards you are about to forget.', clip: {src: 'study.mp4', from: 3, to: 10.2, rate: 1.5}},
  {kind: 'clip', kicker: '03 · Fill in the blank', title: 'Type it. Own it.', sub: 'Cloze cards check your answer and tolerate small typos.', clip: {src: 'study.mp4', from: 10.4, to: 18, rate: 1.5}},
  {kind: 'clip', kicker: '04 · Practice quizzes', title: 'Multiple choice, true/false, fill-in.', sub: 'Instant feedback with explanations, then a score when you finish.', clip: {src: 'quiz.mp4', from: 1.3, to: 19.5, rate: 1.9}},
  {kind: 'themes', kicker: '05 · Themes', title: '21 themes. One click.', sub: 'From Night Library to Blueprint, make studying yours.', clip: {src: 'themes.mp4', from: 0.5, to: 33.5, rate: 2.7}},
];

const INTRO = s(3);
const OUTRO = s(3.5);
const SCENE_STARTS = SCENES.reduce<number[]>((acc, sc, i) => { acc.push(i === 0 ? INTRO : acc[i - 1] + dur(SCENES[i - 1].clip)); return acc; }, []);
export const TOTAL_FRAMES = INTRO + SCENES.reduce((n, sc) => n + dur(sc.clip), 0) + OUTRO;

const INK = '#0a0a0a';
const PAPER = '#f4f1ea';

const THEME_CHIPS = [
  {n: 'Night Library', bg: '#1d2230', fg: '#e0a458'}, {n: 'Fjord', bg: '#dfe6ea', fg: '#2b3a44'}, {n: 'Matcha', bg: '#d1deb9', fg: '#2c3d25'},
  {n: 'Blueprint', bg: '#0a3d91', fg: '#ffffff'}, {n: 'Space', bg: '#04050a', fg: '#00f0ff'}, {n: 'Dark', bg: '#121212', fg: '#e5e5e5'},
];

const Background = () => (
  <AbsoluteFill style={{background: PAPER, backgroundImage: 'linear-gradient(rgba(0,0,0,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.05) 1px, transparent 1px)', backgroundSize: '48px 48px'}} />
);

const Intro = ({vertical}: {vertical: boolean}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame: f, fps, config: {damping: 12}});
  const tag = spring({frame: f - 14, fps, config: {damping: 16}});
  const out = interpolate(f, [INTRO - 8, INTRO], [1, 0], {extrapolateLeft: 'clamp'});
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', fontFamily: FONT, opacity: out, gap: 28}}>
      <Img src={staticFile('icon128.png')} style={{width: vertical ? 260 : 220, transform: `scale(${pop}) rotate(${interpolate(pop, [0, 1], [-12, 0])}deg)`}} />
      <div style={{fontSize: vertical ? 150 : 170, fontWeight: 900, color: INK, letterSpacing: -4, transform: `translateY(${interpolate(pop, [0, 1], [40, 0])}px)`, opacity: pop}}>Retention</div>
      <div style={{fontSize: vertical ? 48 : 52, fontWeight: 700, color: INK, opacity: tag, transform: `translateY(${interpolate(tag, [0, 1], [24, 0])}px)`, background: '#fff', border: `5px solid ${INK}`, boxShadow: `10px 10px 0 ${INK}`, padding: '10px 28px'}}>AI flashcards. Minimalist focus.</div>
    </AbsoluteFill>
  );
};

const Caption = ({sc, vertical, f}: {sc: Scene; vertical: boolean; f: number}) => {
  const {fps} = useVideoConfig();
  const a = spring({frame: f, fps, config: {damping: 16}});
  const b = spring({frame: f - 6, fps, config: {damping: 16}});
  return (
    <div style={{fontFamily: FONT, color: INK, textAlign: vertical ? 'center' : 'left', width: vertical ? 960 : 520}}>
      <div style={{display: 'inline-block', fontSize: 26, fontWeight: 900, letterSpacing: 4, textTransform: 'uppercase', background: INK, color: PAPER, padding: '8px 16px', opacity: a, transform: `translateX(${interpolate(a, [0, 1], [-40, 0])}px)`}}>{sc.kicker}</div>
      <div style={{fontSize: vertical ? 84 : 76, fontWeight: 900, lineHeight: 1.02, marginTop: 24, opacity: b, transform: `translateY(${interpolate(b, [0, 1], [30, 0])}px)`}}>{sc.title}</div>
      <div style={{fontSize: vertical ? 38 : 32, fontWeight: 500, lineHeight: 1.3, marginTop: 20, color: '#333', opacity: b}}>{sc.sub}</div>
    </div>
  );
};

const SceneView = ({sc, len, vertical}: {sc: Scene; len: number; vertical: boolean}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame: f, fps, config: {damping: 15}});
  const fade = interpolate(f, [len - 8, len], [1, 0], {extrapolateLeft: 'clamp'});
  const c = sc.clip;
  const frameW = vertical ? 1000 : 1160;
  const frameH = (frameW * 900) / 1600;
  const chipsIn = (i: number) => spring({frame: f - 20 - i * 6, fps, config: {damping: 14}});
  return (
    <AbsoluteFill style={{opacity: fade, flexDirection: vertical ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: vertical ? 56 : 70, padding: vertical ? '0 40px' : '0 70px'}}>
      <Caption sc={sc} vertical={vertical} f={f} />
      <div style={{position: 'relative', transform: `translateY(${interpolate(pop, [0, 1], [90, 0])}px) scale(${interpolate(pop, [0, 1], [0.94, 1])})`, opacity: pop}}>
        <div style={{width: frameW, height: frameH + 40, background: '#fff', border: `6px solid ${INK}`, boxShadow: `18px 18px 0 ${INK}`, overflow: 'hidden', borderRadius: 6}}>
          <div style={{height: 40, background: INK, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px'}}>
            {['#ff5f57', '#febc2e', '#28c840'].map((col) => <div key={col} style={{width: 14, height: 14, borderRadius: 7, background: col}} />)}
            <div style={{marginLeft: 16, fontFamily: FONT, fontSize: 15, color: '#aaa', letterSpacing: 1}}>Retention — Dashboard</div>
          </div>
          <OffthreadVideo src={staticFile(`clips/${c.src}`)} startFrom={s(c.from)} endAt={s(c.to)} playbackRate={c.rate} muted style={{width: frameW - 12, height: frameH - 7, display: 'block', objectFit: 'cover'}} />
        </div>
        {sc.kind === 'themes' && (
          <div style={{position: 'absolute', left: 0, right: 0, bottom: -86, display: 'flex', gap: 14, justifyContent: 'center'}}>
            {THEME_CHIPS.map((t, i) => (
              <div key={t.n} style={{background: t.bg, color: t.fg, border: `4px solid ${INK}`, boxShadow: `6px 6px 0 ${INK}`, fontFamily: FONT, fontWeight: 900, fontSize: 22, padding: '8px 16px', opacity: chipsIn(i), transform: `translateY(${interpolate(chipsIn(i), [0, 1], [30, 0])}px)`}}>{t.n}</div>
            ))}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

const Outro = ({vertical}: {vertical: boolean}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame: f, fps, config: {damping: 12}});
  const b = spring({frame: f - 12, fps, config: {damping: 16}});
  return (
    <AbsoluteFill style={{background: INK, color: PAPER, fontFamily: FONT, alignItems: 'center', justifyContent: 'center', gap: 26, textAlign: 'center'}}>
      <Img src={staticFile('icon128.png')} style={{width: 220, borderRadius: 36, transform: `scale(${pop})`, background: '#fff'}} />
      <div style={{fontSize: vertical ? 130 : 150, fontWeight: 900, letterSpacing: -3, opacity: pop}}>Retention</div>
      <div style={{fontSize: vertical ? 46 : 50, fontWeight: 700, opacity: b, transform: `translateY(${interpolate(b, [0, 1], [20, 0])}px)`}}>AI flashcards, quizzes &amp; 21 themes</div>
      <div style={{fontSize: 34, fontWeight: 900, background: PAPER, color: INK, padding: '14px 30px', opacity: b, boxShadow: '8px 8px 0 #666'}}>Get it on the Chrome Web Store</div>
    </AbsoluteFill>
  );
};

const Progress = ({total}: {total: number}) => {
  const f = useCurrentFrame();
  return <div style={{position: 'absolute', left: 0, bottom: 0, height: 10, width: `${(f / total) * 100}%`, background: INK}} />;
};

export const Promo = ({vertical}: {vertical: boolean}) => (
  <AbsoluteFill>
    <Background />
    <Sequence durationInFrames={INTRO}><Intro vertical={vertical} /></Sequence>
    {SCENES.map((sc, i) => (
      <Sequence key={sc.kicker} from={SCENE_STARTS[i]} durationInFrames={dur(sc.clip)}>
        <SceneView sc={sc} len={dur(sc.clip)} vertical={vertical} />
      </Sequence>
    ))}
    <Sequence from={TOTAL_FRAMES - OUTRO} durationInFrames={OUTRO}><Outro vertical={vertical} /></Sequence>
    <Progress total={TOTAL_FRAMES} />
  </AbsoluteFill>
);
