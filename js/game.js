//									Adventure Time: The Death of Barney


// Create the canvas
var canvas = document.createElement("canvas");

canvas.width = 1024;
canvas.height = 512;
canvas.style.display = 'block';
canvas.style.marginLeft = "auto";
canvas.style.marginRight = "auto";
canvas.style.border = '2px solid #555555';

document.body.appendChild(canvas);

var 
	ctx = canvas.getContext("2d"), // Grab a reference to the canvas 2D context
	menuPane = document.getElementById("menuPane"),
	startButton = document.getElementById("startButton"),
	musicLine = document.getElementById("musicLine"),
	keysDown = {}, // Handle keyboard events
	gameState = 0, // 0 = not started, 1 = started, 2 = paused
	lastgameState = 0,
	currentTimestamp = 0,
	lastTimestamp = Date.now(),
	musicPlaying = false, 
	backgroundAmbience,
	explosionSFX = new Audio("sfx/explosion.wav"),
	bulletHitSFX = new Audio("sfx/bullet-hit.wav"),
	playerImages = {},
	playerImageIndex = 0,
	playerImageReady = new Array(3);
	playerMaxHealth = 100,
	gameTime = 0,
	tempSrc = 0,
	cooldown = 0,
	lastEnemySpawnThreshold = 1200,
	lastEnemySpawnTimestamp = 0,
	playerHealthBarGradient = ctx.createLinearGradient(5, 0, 15, 0),
	gameTitleGradient = ctx.createLinearGradient(canvas.width * 0.2, 0, canvas.width * 0.8, 0),
	bullets = [],
	bulletIndex = 0,
	enemies = [],
	enemyIndex = 0
;

// Game object representing our player
var player = {
	x: 0,
	y: 410,
	width: 32,
	height: 32,
	speed: 240,
	direction: {
		x: 0,
		y: 0
	},
	health: playerMaxHealth,
	lastSpriteUpdate: 0,
	score: 0,
	dead: false
};

var gameBackground = {
	image: new Image(),
	imageReady: false,
	minX: 0,
	maxX: canvas.width / 8,
	minY: 25,
	maxY: 415,
	trueMaxX : 0,
	trueMaxY : 0
};

var gameRendering = {
	startMenu: false,
	pauseMenu: false
};

var gameExplosion = {
	image: new Image(),
	imageReady: false
};

// Begin Initialization

ctx.strokeRect(0, 0, canvas.width, canvas.height); // stroke the border

gameBackground.image.onload = function () {
	gameBackground.imageReady = true;
};
gameBackground.image.src = "images/gameBackground.jpg";

gameExplosion.image.onload = function () {
	gameExplosion.imageReady = true;
};
gameExplosion.image.src = "images/explosion.png";

gameBackground.trueMaxX = gameBackground.maxX + (player.width / 2); // save calculations on every render event
gameBackground.trueMaxY = gameBackground.maxY + (player.height - 5);

playerHealthBarGradient.addColorStop(0.05, "red");
playerHealthBarGradient.addColorStop(0.5, "yellow");
playerHealthBarGradient.addColorStop(1.0, "#0AFF0A"); // #green

gameTitleGradient.addColorStop(0.10, "red");
gameTitleGradient.addColorStop(0.20, "orange");
gameTitleGradient.addColorStop(0.30, "yellow");
gameTitleGradient.addColorStop(0.40, "lawngreen");
gameTitleGradient.addColorStop(0.50, "cyan");
gameTitleGradient.addColorStop(0.60, "blue");
gameTitleGradient.addColorStop(0.70, "purple");
gameTitleGradient.addColorStop(1.0, "pink");

for(var i = 0; i < 3; ++i) {
	playerImages[i] = new Image();
}

for(var i = 0; i < 3; ++i) {
	playerImages[i].src = "images/jake_armed_" + (i + 1) + ".png";
}

setTimeout(playerIsReady, 15);

explosionSFX.volume = .05;
bulletHitSFX.volume = .05;

// Begin Functions

addEventListener("keydown", function (e) {
	keysDown[e.keyCode] = true;
}, false);

addEventListener("keyup", function (e) {
	delete keysDown[e.keyCode];
	switch(e.keyCode)
	{
		case 77:
		{
			if(backgroundAmbience.paused) {
				backgroundAmbience.play();
			} else {
				backgroundAmbience.pause(); 
			}
		}
		case 27:
		{
			if(gameState == 1) {
				setGameState(2);
			} else if(gameState == 2) {
				setGameState(1);
				lastTimestamp = Date.now(); // prevent frame issues
			}
			break;
		}
		case 17:
		{
			spawnBullet();
			break;
		}
		case 13:
		{
			setupGame();
			break;
		}
	}
}, false);

function intRandom(min, max) { // Get a random number within a range (minimum, maximum), E.G (0, 2) will result in 0 or 1
	return Math.round(min + (Math.random() * (max - min)));
}

function floatRandom(min, max) { // same as intRandom but for floats (no flooring)
	return min + Math.random() * (max - min);
}

function convertTimeToFormattedString(time)
{
	time = (time < 0) ? 0 : parseInt(time);
	var minutes, seconds, timeStr;
	if(time > 59) {
		minutes = Math.floor(time / 60);
		seconds = Math.floor(time - (minutes * 60));
		timeStr = ((minutes < 10) ? ("0" + minutes) : minutes) + ":" + ((seconds < 10) ? ("0" + seconds) : seconds);
	} else {
		timeStr = "00:" + ((time < 10) ? ("0" + time) : time);
	}
	return timeStr;
}

function projectPlayerBoundsCollision(moveX, moveY) {
	
	if(((player.x + moveX) < gameBackground.minX) || ((player.x + moveX) > gameBackground.maxX)
		|| ((player.y + moveY) < gameBackground.minY) || ((player.y + moveY) > gameBackground.maxY)) {
		return false;
	}
	return true;
}

function testCollisionBoundingBox(trans1X, trans1Y, trans1Width, trans1Height, trans2X, trans2Y, trans2Width, trans2Height) {
	return trans1X < trans2X + trans2Width && trans1X + trans1Width > trans2X &&
		trans1Y < trans2Y + trans2Height && trans1Height + trans1Y > trans2Y;
}

startButton.onclick = function() { // Note this is a function
	setupGame();
};

function setupGame() {
	if(gameState == 0) {
		menuPane.style.display = 'none';
		setGameState(1);
		setGameDefaults();
	}
}

function setGameState(newGameState) {
	lastgameState = gameState;
	gameState = newGameState;
	switch(newGameState)
	{
		case 2: // paused
		{
			gameRendering.pauseMenu = false;
		}
	}
}

function setGameDefaults() {
	player.x = intRandom(gameBackground.minX, gameBackground.maxX);
	player.y = intRandom(gameBackground.minY, gameBackground.maxY);
	player.health = playerMaxHealth;
	player.dead = false;
	gameTime = 0;
	lastEnemySpawnThreshold = 1200;
}

function showGameMenu() {
	setGameState(0);
	menuPane.style.display = 'block';
	startButton.innerHTML = "Play Again";
	gameRendering.startMenu = false;
}

function renderGameName() {
	ctx.font = "bold 50px Georgia";
	ctx.textAlign = "center";
	ctx.fillStyle = gameTitleGradient;
	ctx.fillText("Adventure Time: The Death of Barney", canvas.width * 0.5, 75);
}

function progressGameDifficulty() {
	if(lastEnemySpawnThreshold >= 400) {
		lastEnemySpawnThreshold -= 100;
	}
}

function onPlayerDeath() {
	player.dead = true;
	showGameMenu();
}

function enemy(x, y) {
	this.x = x;
	this.y = y;
	this.width = 32;
	this.height = 32;
	this.img = new Image();
	this.ready = false;
	this.explosion = false;
	var self = this;
	this.img.onload = function() {
		self.ready = true;
	}
	this.img.src = "images/barney.png";
}

function bullet(x, y) {
	this.x = x;
	this.y = y;
	this.width = 15;
	this.height = 15;
	this.img = new Image(15, 15);
	var self = this;
	this.img.onload = function() {
		self.ready = true;
	}
	this.img.src = "images/bullet.png";
}

function playerIsReady() { // player images should be loaded by now
	playerImageReady[0] = true;
	playerImageReady[1] = true;
	playerImageReady[2] = true;
	setGameDefaults();
}

function playerUpdateSprite() {
	if(++playerImageIndex >= 3) {
		playerImageIndex = 0;
	}
	player.lastSpriteUpdate = currentTimestamp;
}

function startBackgroundMusic(musicIndex) { // needs more file space for music
	console.log("[LOG]: Starting Music.");
	var musicLocation = "music/", musicName;
	console.log(musicIndex);
	switch(musicIndex)
	{
		case 0: {
			musicName = "Vybz Kartel - Rambo Kanambo.mp3";
			break;
		}
		/*case 1: {
			musicName = "Justin Bieber - Sorry.mp3";
			break;
		}
		case 2: {
			musicName = "Sean Kingston - Take You There.mp3";
			break;
		}*/
		default: {
			console.log("[LOG]: Starting Music FAILED.");
			return;
		}
	}
	musicLocation = musicLocation.concat(musicName);
	backgroundAmbience = new Audio(musicLocation); 
	backgroundAmbience.volume = .12;
	backgroundAmbience.load();
	backgroundAmbience.loop = true;
	backgroundAmbience.play();
	musicPlaying = true;
	musicName = musicName.slice(0, -4); // remove the extension (.mp3, .wav, etc)
	musicLine.innerHTML = musicName;
}

function playSFX(sfxType) {
	switch(sfxType)
	{
		case 0: bulletHitSFX.play();
		case 1: explosionSFX.play();
	}
}

function spawnEnemy() {
	enemies[enemyIndex] = new enemy(canvas.width * 0.95, floatRandom(gameBackground.minY, gameBackground.maxY));
	if(++enemyIndex >= 25) { // 25 enemies the most
		enemyIndex = 0;
	}
}

function spawnBullet() {
	bullets[bulletIndex] = new bullet(player.x + 15, player.y + 5);
	if(++bulletIndex >= 10) { // 10 bullets at a time
		bulletIndex = 0;
	}
}

function onEnemyDeath(index, type) {
	enemies[index].ready = false;
	enemies[index].explosion = true;
	setTimeout(removeEnemyExplosion, 150, index);
	switch(type)
	{
		case false: playSFX(0);
		case true: playSFX(1);
	}
}

function removeEnemyExplosion(index) {
	enemies[index].explosion = false;
}

var handleInput = function() {
	if(gameState == 1) {
		// Stop moving the player
		player.direction.x = 0;
		player.direction.y = 0;

		if(37 in keysDown) { // Left
			player.direction.x = -1;
		}
		if(38 in keysDown) { // Up
			player.direction.y = -1;
		}
		if(39 in keysDown) { // Right
			player.direction.x = 1;
		}
		if(40 in keysDown) { // Down
			player.direction.y = 1;
		}
	}
};

var update = function(elapsed) {
	if(gameState == 1) {
		// Move the player
		if(player.direction.x != 0 || player.direction.y != 0) {
			var move = (player.speed * (elapsed / 1000)), moveX, moveY;

			moveX = Math.round(move * player.direction.x);
			moveY = Math.round(move * player.direction.y);

			if(projectPlayerBoundsCollision(moveX, moveY)) {
				player.x += moveX;
				player.y += moveY;
				if((currentTimestamp - player.lastSpriteUpdate) >= 150) {
					playerUpdateSprite();
				}
			}
		} else {
			if((currentTimestamp - player.lastSpriteUpdate) >= 250) {
				playerUpdateSprite();
			}
		}
		for(var i = 0; i < bullets.length; ++i) {
			if(bullets[i].ready == true) {
				bullets[i].x += 5;
				if(bullets[i].x >= (canvas.width * 0.99)) {
					bullets[i].ready = false;// = null;
				}
			}
		}

		if((currentTimestamp - lastEnemySpawnTimestamp) >= lastEnemySpawnThreshold) {
			spawnEnemy();
			lastEnemySpawnTimestamp = currentTimestamp;
		}
		for(var i = 0; i < enemies.length; ++i) {
			if(enemies[i].ready == true) {
				enemies[i].x -= 5;
				if(enemies[i].x <= (canvas.width * 0.01)) {
					onEnemyDeath(i, false);
					player.health -= intRandom(5, 10);
					if(player.health <= 0) {
						player.health = 0;
						onPlayerDeath();
						break;
					}
					break;
				} else {
					if(enemies[i].x <= gameBackground.trueMaxX) { // only check for collision when barney is in the player's safe zone (EFFICIENCY)
						if(testCollisionBoundingBox(player.x, player.y, player.width, player.height, enemies[i].x, enemies[i].y, enemies[i].width, enemies[i].height)) {
							onEnemyDeath(i, false);
							player.health -= intRandom(20, 50);
							if(player.health <= 0) {
								player.health = 0;
								onPlayerDeath();
								break;
							}
						}
					}

					for(var bID = 0; bID < bullets.length; ++bID) {
						if(bullets[bID].ready == true) {
							if(testCollisionBoundingBox(bullets[bID].x, bullets[bID].y, bullets[bID].width, bullets[bID].height, enemies[i].x, enemies[i].y, enemies[i].width, enemies[i].height)) {
								onEnemyDeath(i, true);
								bullets[bID].ready = false;
								++player.score;
								break;
							}
						}
					}
				}
			}
		}
	}
};

var render = function() {
	switch(gameState)
	{
		case 0:
		{
			if(gameRendering.startMenu === false) {
				ctx.globalAlpha = 0.95;
				ctx.fillStyle = "#111111";
				ctx.fillRect(0, 0, canvas.width, canvas.height);
				ctx.globalAlpha = 1.0;

				gameRendering.startMenu = true;

				renderGameName();

				if(lastgameState != 0) {
					if(player.dead == true) {
						ctx.fillStyle = "red";
						ctx.font = "bold 40px Georgia";
						ctx.textAlign = "center";
						ctx.fillText("WASTED", canvas.width * 0.5, canvas.height * 0.4);
					}
					ctx.fillStyle = "#B1FB17";
					ctx.font = "bold 15px Georgia";
					ctx.textAlign = "center";
					ctx.fillText(player.score + " Barneys Destroyed", canvas.width * 0.5, canvas.height * 0.55);
				}
			}
			break;
		}
		case 1:
		{
			if(gameBackground.imageReady) {
				ctx.drawImage(gameBackground.image, 0, 0, canvas.width, canvas.height);

				// draw gameTime

				ctx.fillStyle = "#FF2233";
				ctx.font = "bold 15px Georgia"; 
				ctx.fillText(convertTimeToFormattedString(gameTime), canvas.width * 0.95, 17);

				// draw Health bar

				ctx.fillStyle = playerHealthBarGradient;
				ctx.fillRect(5, 5, (player.health / 100) * (canvas.width * 0.1), 15);

				// draw Score

				ctx.fillStyle = "#B1FB17";
				ctx.font = "bold 15px Georgia";
				ctx.textAlign = "center";
				ctx.fillText(player.score + " Barneys Destroyed", canvas.width * 0.5, 17);

				ctx.globalAlpha = 0.2;
				ctx.beginPath();
				ctx.moveTo(gameBackground.trueMaxX, gameBackground.minY);
				ctx.lineTo(gameBackground.trueMaxX, gameBackground.trueMaxY);
				ctx.closePath();
				ctx.strokeStyle = "#BCD5F5"; // lightgrey with a tint of blue
				ctx.stroke();
				ctx.globalAlpha = 1;
			} else {
				ctx.fillStyle = "rgb(100, 100, 100)";
				ctx.fillRect(0, 0, canvas.width, canvas.height);
			}

			// Draw player
			if(playerImageReady[playerImageIndex]) {
				// Render image to canvas
				ctx.drawImage(
					playerImages[playerImageIndex],
					0, 0, player.width, player.height,
					player.x, player.y, player.width, player.height
				);
			} else {
				// Image not ready. Draw a yellow box
				ctx.fillStyle = "rgb(0, 255, 255)";
				ctx.fillRect(player.x, player.y, player.width, player.height);
			}

			for(var i = 0; i < bullets.length; ++i) {
				if(bullets[i].ready === true) {
					ctx.drawImage(bullets[i].img, bullets[i].x, bullets[i].y, 15, 15);
				}
			}

			for(var i = 0; i < enemies.length; ++i) {
				if(enemies[i].ready === true) {
			    	ctx.drawImage(
						enemies[i].img,
						0, 0, enemies[i].width, enemies[i].height,
						enemies[i].x, enemies[i].y, enemies[i].width, enemies[i].height
					);
				} else {
					if(enemies[i].explosion === true) {
						ctx.drawImage(
							gameExplosion.image,
							0, 0, enemies[i].width, enemies[i].height,
							enemies[i].x, enemies[i].y + 1, enemies[i].width, enemies[i].height
						);
					}
				}
			}
			break;
		}
		case 2:
		{
			if(gameRendering.pauseMenu === false) {
				gameRendering.pauseMenu = true;

				ctx.globalAlpha = 0.975;
				ctx.beginPath();
				ctx.strokeStyle = "black";
				ctx.fillStyle = "black";
				ctx.fillRect(0, 0, canvas.width, canvas.height);
				ctx.closePath();
				ctx.stroke();
				ctx.globalAlpha = 1.0;

				renderGameName();

				ctx.fillStyle = "blue";
				ctx.font = "bold 40px Georgia";
				ctx.textAlign = "center";
				ctx.fillText("PAUSED", canvas.width * 0.5, canvas.height * 0.5);
			}
		}
	}
};

var overlay = function() {
	gameTime++;
	if((gameTime % 20) === 0) {
		progressGameDifficulty();
		console.log("Difficulty progressed.");
	}
}

// Main game loop
var main = function() {
	// Calculate time since lastTimestamp frame
	currentTimestamp = Date.now();
	var delta = (currentTimestamp - lastTimestamp);
	lastTimestamp = currentTimestamp;

	// Handle any user input
	handleInput();

	// Update game objects
	update(delta);

	// Render to the screen
	render();

	if (!musicPlaying) {
		startBackgroundMusic(0); // intRandom(0, 3)
	}
	window.requestAnimationFrame(main); // using request animation frame so pausing won't mess up our game.
};

// Begin the game 

setInterval(overlay, 999); // 999 because computer time can not be trusted :)
requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame || window.mozRequestAnimationFrame;
main();