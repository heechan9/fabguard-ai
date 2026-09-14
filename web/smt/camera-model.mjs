// Camera framing only; these values do not describe physical equipment performance.
export const MIN_ZOOM=0.035, MAX_ZOOM=1.8;
export const clampZoom=value=>Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,value));
export const overviewDistance=aspect=>aspect<1.35?47:36;
export function stationZoom(width,aspect){
  // Fit the machine with room for its height and rotation on narrow viewports.
  const span=Math.max(width+1.5,4.5);
  const distance=span/(2*Math.tan(21*Math.PI/180)*Math.min(1,Math.max(aspect,0.1)));
  return clampZoom(distance/overviewDistance(aspect));
}
