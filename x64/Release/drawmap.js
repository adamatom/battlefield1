

var ninety_deg = 1.5708;

// configuration
//var cone_depth = 80; // 80 meters to help with sniping
var marker_sz = 10;
var height_threshold = 3;
//var max_map_radius = 80;
var canvas = document.getElementById('canvas');

var last_response = {status: "failure"};
// resize the canvas to fill browser window dynamically
window.addEventListener('resize', resizeCanvas, false);

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function draw_vehicle(ctx, pos, color) {
    ctx.save();
    ctx.translate(pos.x,pos.z);
    ctx.fillStyle = color;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.beginPath();
    // "tracks"
    var track_width = marker_sz * 0.3;
    var track_height = marker_sz * 1.5;
    ctx.fillRect(-0.5*marker_sz-track_width/2, -0.5*track_height, track_width, track_height);
    ctx.fillRect(0.5*marker_sz-track_width/2, -0.5*track_height, track_width, track_height);
    // body
    if( Math.abs(pos.y) <= height_threshold ) {
        ctx.fillRect(-0.5*marker_sz, -0.5*marker_sz, marker_sz, marker_sz);
    } else {
        ctx.rect(-0.5*marker_sz, -0.5*marker_sz, marker_sz, marker_sz);
        ctx.stroke();
    }
    ctx.closePath();
    ctx.restore();
}

function draw_soldier(ctx, pos, color) {
    ctx.save();
    ctx.translate(pos.x,pos.z);
    ctx.rotate(0.785398); // 45 degrees
    ctx.fillStyle = color;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.beginPath();
    if( Math.abs(pos.y) <= height_threshold ) {
        ctx.fillRect(-0.5*marker_sz, -0.5*marker_sz, marker_sz, marker_sz);
    } else {
        ctx.rect(-0.5*marker_sz, -0.5*marker_sz, marker_sz, marker_sz);
        ctx.stroke();
    }
    ctx.closePath();
    ctx.restore();
}

// convert from world to player space (translation)
// then from player space to player-up space (rotation)
// then from player-up space to map space (scale)

function world_to_player(local, remote) {
    return {
        x: remote.x - local.x,
        y: remote.y - local.y,
        z: remote.z - local.z
    }
}

function player_to_playerup(player_yaw, player) {
    return {
        // yaw is angle from z axis, which points south. x points east
        x: -1*player.x*Math.cos(player_yaw) - player.z*Math.sin(player_yaw),
        y: player.y,
        z: player.x*Math.sin(player_yaw) - player.z*Math.cos(player_yaw)
    }
}

function playerup_to_map(player) {
    var max_map_radius = document.getElementById('map_radius').value;
    var norm_x = player.x / max_map_radius;
    var norm_z = player.z / max_map_radius;
    var half_radius = Math.min(canvas.width/2, canvas.height/2);
    return {
        x: norm_x*half_radius,
        y: player.y,
        z: norm_z*half_radius
    }
}

function draw_fov_cone(ctx, fov, alpha) {
    ctx.save();
    var cone_depth = document.getElementById('cone_depth').value;
    var cone_width = Math.tan(fov/2) * cone_depth;
    // cheat by using one point of the fov triangle to get coordinates, then mirror.
    var map_coords = playerup_to_map({x: cone_width, y: 0, z: 0-cone_depth});
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-map_coords.x, map_coords.z); // mirror about y axis
    ctx.lineTo(map_coords.x, map_coords.z); 
    ctx.lineTo(0, 0);
    ctx.fillStyle = "rgba(200,200,200, "+ alpha + ")";
    ctx.fill();
    ctx.closePath();
    ctx.restore();
}

function draw_team(ctx, local, team_array, color ) {
    if (team_array == null ) return;
    var local_pos = { x: local.x, y: local.y, z:local.z }
    for (var i = 0, len = team_array.length; i < len; i++) {
        var remote = team_array[i];
        if (remote.health === 0.0 ) continue;

        var remote_pos = {x: remote.x, y: remote.y, z: remote.z };
        var player_space = world_to_player(local_pos, remote_pos);
        var playerup_space = player_to_playerup(local.yaw, player_space);
        var map_space = playerup_to_map(playerup_space);
        if( remote.is_vehicle ) {
            draw_vehicle(ctx, map_space, color);
        } else {
            draw_soldier(ctx, map_space, color);
        }
    }
}

function draw_map() {
    resizeCanvas();
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    ctx.translate(canvas.width/2, canvas.height/2);
    var enemy_color = '#df3939';
    var mate_color = '#52a5f8';
    var unknown_color = '#ffffff';

    if (last_response.status !== "success" ) { return; }

    var fov_rad = (Math.PI/180)*last_response.local_player.fov;
    var center_screen_fov = fov_rad * 0.5;
    var under_reticle_fov = fov_rad * 0.2;
    draw_fov_cone(ctx, center_screen_fov, 0.15); 
    draw_fov_cone(ctx, under_reticle_fov, 0.15); 

    if (last_response.local_player.team === 1 ) {
        draw_team(ctx, last_response.local_player, last_response.team1, mate_color);
        draw_team(ctx, last_response.local_player, last_response.team2, enemy_color);
    } else if (last_response.local_player.team === 2) {
        draw_team(ctx, last_response.local_player, last_response.team2, mate_color);
        draw_team(ctx, last_response.local_player, last_response.team1, enemy_color);
    } else {
        draw_team(ctx, last_response.local_player, last_response.team1, unknown_color);
        draw_team(ctx, last_response.local_player, last_response.team2, unknown_color);
    }

    ctx.restore();
}

function request_data() {
    var xmlhttp = new XMLHttpRequest();
    var url = "/report";

    xmlhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            last_response = JSON.parse(this.responseText);
        }
    };
    xmlhttp.open("GET", url, true);
    xmlhttp.send();
}

setInterval(request_data, 50);
setInterval(draw_map, 50);
resizeCanvas();