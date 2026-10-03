import {Composition} from 'remotion';
import {Promo, TOTAL_FRAMES} from './Promo';

export const Root = () => (
  <>
    <Composition id="Promo" component={Promo} durationInFrames={TOTAL_FRAMES} fps={30} width={1920} height={1080} defaultProps={{vertical: false}} />
    <Composition id="PromoVertical" component={Promo} durationInFrames={TOTAL_FRAMES} fps={30} width={1080} height={1920} defaultProps={{vertical: true}} />
  </>
);
