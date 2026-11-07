export const CROP = Object.freeze({x:700,y:265,width:640,height:360});
export const C1 = Object.freeze({cx:1158,cy:421.4,r:90.5,rpm:45,phase:91.0557374652127});
export const clamp = (n, a=0, b=1) => Math.max(a,Math.min(b,n));
export function frameIndex(time, count) { return clamp(Math.floor(time*60+0.001),0,count-1); }
export function armFrame(angle) { return clamp(angle+22,0,35); }
export function armAngle(progress, ejectMs=null) {
  const angle=13*clamp(progress);
  if(ejectMs===null)return angle;
  const u=clamp(ejectMs/160),smooth=u*u*u*(u*(u*6-15)+10);
  return angle+(-22-angle)*smooth;
}
export function fitCabinet(width,height) {const scale=Math.min(width/1920,height/1080);return {scale,x:(width-1920*scale)/2,y:(height-1080*scale)/2};}
// Project the existing Blender label quad, preserving its occlusion atlas.
export function projection(q) {
  const [a,b,c,d]=[q[3],q[2],q[1],q[0]].map(([x,y])=>[(x-CROP.x)*1.2,(y-CROP.y)*1.2]);
  const x1=b[0]-c[0],x2=d[0]-c[0],x3=a[0]-b[0]+c[0]-d[0],y1=b[1]-c[1],y2=d[1]-c[1],y3=a[1]-b[1]+c[1]-d[1],det=x1*y2-x2*y1;
  if(Math.abs(det)<1e-7)return null;
  const g=(x3*y2-x2*y3)/det,h=(x1*y3-x3*y1)/det;
  return(u,v)=>{const z=g*u+h*v+1;return[(a[0]+(b[0]-a[0]+g*b[0])*u+(d[0]-a[0]+h*d[0])*v)/z,(a[1]+(b[1]-a[1]+g*b[1])*u+(d[1]-a[1]+h*d[1])*v)/z];};
}
