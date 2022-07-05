//TO DO LIST
//-visualise canvas as heightmap
//-implement drawAt just cutting out
//-add mass-preservation to drawAt so it pushes sand outwards
//-angle of repose calculations
//-use lighting to render rather than pure height
//-texture sand so that edited sand pixels have a chance of randomizing

//get canvas object
var canvas = null;
var ctx = null;
var x_adjustment=1;
var y_adjustment=1;

var last_x=0;
var last_y=0;

//hook up onload
window.onload = onLoaded;

//brush constants
const BRUSH_BOTTOM = 0;
const BRUSH_ANGLE = 120;

const BRUSH_MAX_SLOPE = 1;

const ANGLE_OF_REPOSE = 34;

//get canvas width/height from css
var CANVAS_WIDTH;
var CANVAS_HEIGHT;

const MAX_SAND_HEIGHT = 10;
const INITIAL_SAND_HEIGHT = 5;

var heightmap;
var heightmap_old;
var max_height_map;

var nib_trail_x=0;
var nib_trail_y=0;

var brush_tilt_angle = 0;
var brush_tilt_amount = 0;

function lerpColor(a, b, amount) { 

    var ah = parseInt(a.replace(/#/g, ''), 16),
        ar = ah >> 16, ag = ah >> 8 & 0xff, ab = ah & 0xff,
        bh = parseInt(b.replace(/#/g, ''), 16),
        br = bh >> 16, bg = bh >> 8 & 0xff, bb = bh & 0xff,
        rr = ar + amount * (br - ar),
        rg = ag + amount * (bg - ag),
        rb = ab + amount * (bb - ab);

    return '#' + ((1 << 24) + (rr << 16) + (rg << 8) + rb | 0).toString(16).slice(1);
}

var color_ramp_short=[
    "#663931",
    "#8f563b",
    "#d9a066",
    "#eec39a",
];

var color_ramp_long=[];
for (var i=0;i<color_ramp_short.length-1;i++){
    const INTERP_STEPS=4;
    for (var j=0;j<INTERP_STEPS;j++){
        color_ramp_long.push(lerpColor(color_ramp_short[i],color_ramp_short[i+1],j/INTERP_STEPS));
    }
}

color_ramp_long.push(color_ramp_short[color_ramp_short.length]);

function renderBoard() {
    //render from 0 (black) to MAX_HEIGHT (white)
    // for (var i = 0; i < CANVAS_WIDTH; i++) {
    //     for (var j = 0; j < CANVAS_HEIGHT; j++) {
    //         if (heightmap[i][j]===heightmap_old[i][j]) {
    //             continue;
    //         }
    //         var color = 255*(heightmap[i][j] / MAX_SAND_HEIGHT);
    //         canvas.getContext('2d').fillStyle = "rgb(" + color + "," + color + "," + color + ")";
    //         canvas.getContext('2d').fillRect(i, j, 1, 1);
    //     }
    // }

    for (var i = 1; i < CANVAS_WIDTH-1; i++) {
        for (var j = 1; j < CANVAS_HEIGHT-1; j++) {
            if (heightmap[i+CANVAS_WIDTH*j]===heightmap_old[i+CANVAS_WIDTH*j]) {
                continue;
            }
            var dx = heightmap[i+1+CANVAS_WIDTH*j] - heightmap[i-1+CANVAS_WIDTH*j];
            var dy = heightmap[i+CANVAS_WIDTH*(j+1)] - heightmap[i+CANVAS_WIDTH*(j-1)];
            //max brightness if dx && dy are 4
            //min brightness if dx && dy are -4
            const brightness_index = (-dx+dy+8);
            // const color = Math.floor(255*brightness_pc);
            canvas.getContext('2d').fillStyle = color_ramp_long[brightness_index];//"rgb(" + color + "," + color + "," + color + ")";
            canvas.getContext('2d').fillRect(i, j, 1, 1);

            heightmap_old[i+CANVAS_WIDTH*j] = heightmap[i+CANVAS_WIDTH*j];
        }
    }

    //draw nib
    // canvas.getContext('2d').fillStyle = "red";
    // canvas.getContext('2d').fillRect(nib_trail_x, nib_trail_y, 1, 1);

    //set heightmapold = heightmap
    for (var i = 0; i < CANVAS_WIDTH; i++) {
        heightmap_old[i+CANVAS_WIDTH*0] = heightmap[i+CANVAS_WIDTH*0];
        heightmap_old[i+CANVAS_WIDTH-1] = heightmap[i+CANVAS_WIDTH-1];
    }
    for (var i = 0; i < CANVAS_HEIGHT; i++) {
        heightmap_old[0+CANVAS_WIDTH*i] = heightmap[0+CANVAS_WIDTH*i];
        heightmap_old[CANVAS_WIDTH-1+CANVAS_WIDTH*i] = heightmap[CANVAS_WIDTH-1+CANVAS_WIDTH*i];
    }
    

}

const MAX_SAND_SLOPE=1;


function moveSandGrain(i,j,nib_x,nib_y){
    var dx = i-nib_x;
    var dy = j-nib_y;
    const distance_from_nib = Math.sqrt(Math.pow(dx,2)+Math.pow(dy,2));

    //pick a direction to distribute it in
    var distribution_direction_x;
    var distribution_direction_y;
    if (distance_from_nib<1){
        //pick random direction
        const distrubtion_angle_random = Math.random()*2*Math.PI;
        distribution_direction_x = Math.cos(distrubtion_angle_random);
        distribution_direction_y = Math.sin(distrubtion_angle_random);
    } else {
        //find angle based on dx,dy
        const distrubtion_angle = Math.atan2(dy,dx);
        //jitter it a bit - say +/-10,
        const distrubtion_angle_jittered = distrubtion_angle+(Math.random()-0.5)*20.0*Math.PI/180;
        distribution_direction_x = Math.cos(distrubtion_angle_jittered);
        distribution_direction_y = Math.sin(distrubtion_angle_jittered);                                                
    }

    //move in this direction until you find an unaffected pixel
    var i_new = i;
    var j_new = j;
    var i_new_floord = Math.floor(i_new);
    var j_new_floord = Math.floor(j_new);
    var ij_heightmap_max = max_height_map[i+CANVAS_WIDTH*j];
    var step_count=0;
    const next_x_coordinate_diff=distribution_direction_x>0?1:-1;
    const next_y_coordinate_diff=distribution_direction_y>0?1:-1;
    var flat_x=true;
    var flat_y=true;
    while (
        heightmap[i_new_floord+CANVAS_WIDTH*j_new_floord]>=max_height_map[i_new_floord+CANVAS_WIDTH*j_new_floord]||
        !flat_x || !flat_y
        ){
        step_count++;
        i_new += distribution_direction_x;
        j_new += distribution_direction_y;
        i_new_floord = Math.floor(i_new);
        j_new_floord = Math.floor(j_new);
        
        if (i_new_floord<0 || i_new_floord>=CANVAS_WIDTH || j_new_floord<0 || j_new_floord>=CANVAS_HEIGHT){
            return;
        }    
        
        var i_horizont_ahead = i_new_floord+next_x_coordinate_diff;
        var j_vertical_ahead = j_new_floord+next_y_coordinate_diff;
        if (i_horizont_ahead>=0 && i_horizont_ahead<CANVAS_WIDTH){
            flat_x = !(heightmap[i_horizont_ahead+CANVAS_WIDTH*j_new_floord]+1<heightmap[i_new_floord+CANVAS_WIDTH*j_new_floord]);
        } else {
            flat_x=true;
        }
        if (j_vertical_ahead>=0 && j_vertical_ahead<CANVAS_HEIGHT){
            flat_y = !(heightmap[i_new_floord+CANVAS_WIDTH*j_vertical_ahead]+1<heightmap[i_new_floord+CANVAS_WIDTH*j_new_floord]);
        } else {
            flat_y=true;
        }
                    
    }
    heightmap[i_new_floord+CANVAS_WIDTH*j_new_floord]++;
    heightmap[i+CANVAS_WIDTH*j]--;     
    //if the new position is more than 2 higher than any neighbouring pixel, fill that neighbouring pixel instead
    // var new_height = heightmap[i_new_floord+CANVAS_WIDTH*j_new_floord];
    // if (new_height>heightmap[i_new_floord+1+CANVAS_WIDTH*(j_new_floord+0)]+1){
    //     heightmap[i_new_floord+CANVAS_WIDTH*j_new_floord]--;
    //     heightmap[i_new_floord+1+CANVAS_WIDTH*j_new_floord]++;
    // } else if (new_height>heightmap[i_new_floord-1+CANVAS_WIDTH*(j_new_floord+0)]+1){
    //     heightmap[i_new_floord+CANVAS_WIDTH*j_new_floord]--;
    //     heightmap[i_new_floord-1+CANVAS_WIDTH*j_new_floord]++;
    // } else if (new_height>heightmap[i_new_floord+0+CANVAS_WIDTH*(j_new_floord+1)]+1){
    //     heightmap[i_new_floord+CANVAS_WIDTH*j_new_floord]--;
    //     heightmap[i_new_floord+CANVAS_WIDTH*(j_new_floord+1)]++;
    // }  else if (new_height>heightmap[i_new_floord+0+CANVAS_WIDTH*(j_new_floord-1)]+1){
    //     heightmap[i_new_floord+CANVAS_WIDTH*j_new_floord]--;
    //     heightmap[i_new_floord+CANVAS_WIDTH*(j_new_floord-1)]++;
    // } 
}

function drawAt(x, y, pressure) {

    var nib_x = x;
    var nib_y = y;

    for (var i = 0; i < CANVAS_WIDTH; i++) {
        for (var j = 0; j < CANVAS_HEIGHT; j++) {
            var dx = i-nib_x;
            var dy = j-nib_y;
            if (dx>0){
                dx*=x_adjustment;
            } else {
                dx/=x_adjustment;
            }
            if (dy>0){
                dy*=y_adjustment;
            } else {
                dy/=y_adjustment;
            }
            const ij_radius = Math.sqrt(Math.pow(dx,2)+Math.pow(dy,2));
            const slop_height_ij = BRUSH_MAX_SLOPE*ij_radius+(1-2*pressure)*INITIAL_SAND_HEIGHT;

            const max_height = Math.floor(Math.min(MAX_SAND_HEIGHT, slop_height_ij));
            max_height_map[i+CANVAS_WIDTH*j] = max_height;
        }
    }

    
    //loop through board
    
    for (var i = 0; i < CANVAS_WIDTH; i++) {
        for (var j = 0; j < CANVAS_HEIGHT; j++) {
            const sand_height = heightmap[i+CANVAS_WIDTH*j];
            const dx = x - i;
            const dy = y - j;
            var distance_from_nib = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2)); 

            const d_radius = distance_from_nib;
            
            const MAX_HEIGHT_IJ = max_height_map[i+CANVAS_WIDTH*j];

            if (sand_height>MAX_HEIGHT_IJ){
                var excess = sand_height-MAX_HEIGHT_IJ;

                for (var excess_i=0;excess_i<excess;excess_i++){
                    moveSandGrain(i,j,nib_x,nib_y);       
                }
            }                        
        }
    }

    
    renderBoard();
}

function clearBoard() {

    resetPage();
    renderBoard();
}


function queue_last_points(x,y){

    var MOVE_SPEED = 3;
    //move nib_trail towards x,y
    var trail_dx = x-nib_trail_x;
    var trail_dy = y-nib_trail_y;
    //normalize trail
    var trail_length = Math.sqrt(Math.pow(trail_dx,2)+Math.pow(trail_dy,2));
    if (trail_length>MOVE_SPEED){
        trail_dx /= trail_length;
        trail_dy /= trail_length;
        nib_trail_x-=trail_dx;
        nib_trail_y-=trail_dy;
    } else {
        nib_trail_x=x;
        nib_trail_y=y;
    }



    //distance from x,y
    const dx = nib_trail_x-x;
    const dy = nib_trail_y-y;

    const MAX_DIST = 20;
    const distance = Math.sqrt(dx*dx+dy*dy);
    if (distance>MAX_DIST){
        //move towards x,y so that it's MAX_DIST AWAY
        nib_trail_x = x + dx*MAX_DIST/distance;
        nib_trail_y = y + dy*MAX_DIST/distance;
    }
}
function calculate_adjustment(nib_x,nib_y,tiltX,tiltY){
    
    if (tiltX!==null && (tiltX!==0&&tiltY!==0)){
        //scale tiltX from -90,90 to -2,2
        tiltX = -tiltX*2/90;
        tiltY = -tiltY*2/90;
        x_adjustment = Math.pow(2,tiltX);
        y_adjustment = Math.pow(2,tiltY);
        return;
    }
    //use nib_trail_x/y to adjust x/y
    var trail_dx = nib_x-nib_trail_x;
    var trail_dy = nib_y-nib_trail_y;
    //normalize trail
    var trail_length = Math.sqrt(Math.pow(trail_dx,2)+Math.pow(trail_dy,2));
    if (trail_length>0){
        trail_dx /= trail_length;
        trail_dy /= trail_length;
    } else {
        trail_dx = 0;
        trail_dy = 0;
    }

    const LERP_AMOUNT=0.1
    x_adjustment = x_adjustment*(1-LERP_AMOUNT)+ Math.pow(2,-trail_dx)*LERP_AMOUNT;
    y_adjustment = y_adjustment*(1-LERP_AMOUNT)+Math.pow(2,trail_dy)*LERP_AMOUNT;
}
function onPointerDown(event) {
    
    //call drawat
    var [x,y] = getXY(event);
    last_x=x;
    last_y=y;
    nib_trail_x=x;
    nib_trail_y=y;
    calculate_adjustment(x,y,event.pointerType==="pen"?event.tiltX:0,event.pointerType==="pen"?event.tiltY:0);
    var pressure = event.pressure;
    if (pressure===0){
        pressure=0.5;
    }
    console.log("x,y = " + x + "," + y);
    console.log("pressure = " + pressure);
    drawAt(x, y, pressure);
}

function getXY(event){
    
    const bb = canvas.getBoundingClientRect();
    var client_x = event.clientX;
    var client_y = event.clientY;
    

    var x = Math.floor( (client_x - bb.left) / bb.width * canvas.width );
    var y = Math.floor( (client_y - bb.top) / bb.height * canvas.height );

    const visible_box_ratio = bb.width/bb.height;
    if (visible_box_ratio > CANVAS_WIDTH/CANVAS_HEIGHT)
     {
        const horizontal_scale = visible_box_ratio/(CANVAS_WIDTH/CANVAS_HEIGHT);
         x=CANVAS_WIDTH/2+ (x-CANVAS_WIDTH/2)*horizontal_scale;
     } else {
        const vertical_scale = (CANVAS_WIDTH/CANVAS_HEIGHT)/visible_box_ratio;
        y=CANVAS_HEIGHT/2+ (y-CANVAS_HEIGHT/2)*vertical_scale;
     }

    return[x,y];
}

function drawTo(x,y,pressure,tiltX,tiltY){

    //distance of x,y to last_x,last_y
    var dx = x-last_x;
    var dy = y-last_y;
    var distance = Math.sqrt(dx*dx+dy*dy);

    const MAX_DIST = 3;

    while (distance>MAX_DIST){
        //move last_x,last_y MAX_DISTANCE units towards x,y
        last_x += dx*MAX_DIST/distance;
        last_y += dy*MAX_DIST/distance;
        
        calculate_adjustment(x,y,tiltX,tiltY);
        drawAt(last_x, last_y, pressure);
        queue_last_points(last_x,last_y);

        dx = x-last_x;
        dy = y-last_y;
        distance = Math.sqrt(dx*dx+dy*dy);

    }
    calculate_adjustment(x,y,tiltX,tiltY);
    drawAt(x, y, pressure);
    queue_last_points(x,y);

    last_x = x;
    last_y = y;
}
function onPointerMove(event) {
    //if mouse not held, return
    if (!event.buttons) {
        return;
    }

    var [x,y] = getXY(event);

    var pressure = event.pressure;
    if (pressure===0){
        pressure=0.5;
    }

    drawTo(x,y,pressure,event.pointerType==="pen"?event.tiltX:0,event.pointerType==="pen"?event.tiltY:0);

}

function onPointerUp(event) {

    var [x,y] = getXY(event);
    // else {
    //     //portrait
    //     client_x = client_x - bb.width/2;
    //     client_y = client_y - bb.height/2;
    // }

    var pressure = event.pressure;
    if (pressure===0){
        pressure=0.5;
    }

    drawTo(x,y,event.pressure,event.pointerType==="pen"?event.tiltX:0,event.pointerType==="pen"?event.tiltY:0);
}

function resetPage(){
    
    heightmap = new Uint8Array(CANVAS_WIDTH*CANVAS_HEIGHT);

    for (var i = 0; i < CANVAS_WIDTH; i++) {
        for (var j = 0; j < CANVAS_HEIGHT; j++) {
            //jitter is int from -1 to 1
            const jitter = Math.floor(Math.random()*2)-1;
            heightmap[i+CANVAS_WIDTH*j] = INITIAL_SAND_HEIGHT+jitter;
        }
    }

    heightmap_old = new Uint8Array(CANVAS_WIDTH*CANVAS_HEIGHT);
    for (var i = 0; i < CANVAS_WIDTH; i++) {
        for (var j = 0; j < CANVAS_HEIGHT; j++) {
            heightmap_old[i+CANVAS_WIDTH*j] = 255;
        }
    }

    max_height_map = new Uint8Array(CANVAS_WIDTH*CANVAS_HEIGHT);
    for (var i = 0; i < CANVAS_WIDTH; i++) {
        for (var j = 0; j < CANVAS_HEIGHT; j++) {
            max_height_map[i+CANVAS_WIDTH*j] = MAX_SAND_HEIGHT;
        }
    }
}
function onLoaded() {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    CANVAS_WIDTH = canvas.width;
    CANVAS_HEIGHT = canvas.height;

    
    ctx.canvas.style.width  = window.innerWidth;
    ctx.canvas.style.height = window.innerHeight;

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);

    resetPage();

    renderBoard();
}