// A multi-pointer gesture cannot turn into a tap when its final finger lifts.
export class TapGuard {
 constructor(){this.ids=new Set();this.blocked=false;this.distance=0;}
 down(id){if(!this.ids.size){this.blocked=false;this.distance=0;}this.ids.add(id);if(this.ids.size>1)this.blocked=true;}
 move(id,dx,dy){if(this.ids.has(id))this.distance+=Math.abs(dx)+Math.abs(dy);}
 end(id,cancel=false){const tap=this.ids.has(id)&&this.ids.size===1&&!this.blocked&&!cancel&&this.distance<8;if(cancel)this.blocked=true;this.ids.delete(id);return tap;}
}
