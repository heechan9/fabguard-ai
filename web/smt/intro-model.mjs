// Presentation timing only: no physical time, performance or prediction claims.
export const INTRO_SECONDS=10;
export function introShot(seconds){
 const t=Math.max(0,Math.min(INTRO_SECONDS,Number.isFinite(seconds)?seconds:0));
 const touring=t>=2&&t<8;
 const progress=Math.max(0,Math.min(1,(t-2)/6));
 return {t,touring,progress,station:touring?Math.min(10,Math.floor(progress*11)):null,
  heading:t<2?'전자기판은 어떻게 만들어질까요?':t<8?'11개 공정을 따라가 보세요':'공정의 흐름을 이해하는 첫걸음',
  subtitle:t<2?'FabGuard AI · SMT 3D Lab':t<8?'부품 조립부터 검사까지, 설명용 3D 체험':'가상 이상 상황 · 검사 근거 · 기판 이력'};
}
export function recordingFormat(Recorder){
 if(!Recorder?.isTypeSupported)return null;
 for(const [mime,extension] of [['video/mp4;codecs=avc1.42E01E','mp4'],['video/mp4','mp4'],['video/webm;codecs=vp8','webm'],['video/webm','webm']]){
  if(Recorder.isTypeSupported(mime))return {mime,extension};
 }
 return null;
}
