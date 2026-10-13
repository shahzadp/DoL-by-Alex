class Coordinate {
	/**
	 * X value of location on grid.
	 *
	 * @type {number}
	 */
	x;

	/**
	 * Y value of location on grid
	 *
	 * @type {number}
	 */
	y;

	/**
	 * @param {number} Size Size of grid
	 * @param {Coordinate} [PC] PC location
	 * @param {number} [Distance] Minimum distance from PC
	 */
	constructor(Size, PC = null, Distance = 0) {
		if (PC) {
			this.x = this.proximityGenerator(PC.x, Distance, Size);
			this.y = this.proximityGenerator(PC.y, Distance, Size);
		} else {
			this.x = Math.floor(Math.random() * Size);
			this.y = Math.floor(Math.random() * Size);
		}
	}

	/**
	 * @param {Coordinate} Coordinate Coordinate Object to compare
	 */
	equals(Coordinate) {
		return this.x === Coordinate.x && this.y === Coordinate.y;
	}

	/**
	 * Generates a number that is at least Distance rooms away from Number
	 *
	 * @param {number} Number Number to generate from
	 * @param {number} Distance Minimum Distance from PC
	 * @param {number} Size Size of grid
	 * @returns {number} Generated number
	 */
	proximityGenerator(Number, Distance, Size) {
		const Locations = [];
		for (let i = 0; i < Size; i++) Locations.push(i);

		Coordinate.distanceRemover(Number, Distance, Locations);
		Locations.reverse();
		Coordinate.distanceRemover(Number, Distance, Locations);
		Locations.delete(Number);
		return Locations.random();
	}

	/**
	 * Removes numbers that is at least Distance away from Number from Locations
	 *
	 * @param {number} Number Number to generate from
	 * @param {number} Distance Minimum Distance from PC
	 * @param {number[]} Locations Array of x/y values
	 */
	static distanceRemover(Number, Distance, Locations) {
		let Found;
		const ToDelete = [];
		for (let i = 0; i < Locations.length; i++) {
			if (Found <= Distance) {
				ToDelete.push(Locations[i]);
				Found++;
			}
			if (Locations[i] === Number) {
				Found = 1;
			}
		}
		ToDelete.forEach(x => Locations.delete(x));
	}

	/**
	 * Moves Coordinate up one
	 */
	up() {
		this.y--;
	}

	/**
	 * Moves Coordinate down one
	 */
	down() {
		this.y++;
	}

	/**
	 * Moves Coordinate left one
	 */
	left() {
		this.x--;
	}

	/**
	 * Moves Coordinate right one
	 */
	right() {
		this.x++;
	}

	/**
	 * Generates an Array of possible directions
	 *
	 * @param {number} Size Size of grid
	 * @returns {string[]} Array of moveable directions
	 */
	possibleDirections(Size) {
		const dir = [];

		if (this.x !== 0) dir.push("left");
		if (this.x !== Size - 1) dir.push("right");
		if (this.y !== 0) dir.push("up");
		if (this.y !== Size - 1) dir.push("down");

		return dir;
	}

	/**
	 * Checks if coord is in adjacent room
	 *
	 * @param {Coordinate} coord Coord to check proximity of
	 * @returns {boolean} Return true if coord is in adjacent room
	 */
	proximityCheck(coord) {
		if (coord.x === this.x - 1 && coord.y === this.y) return true;
		if (coord.x === this.x + 1 && coord.y === this.y) return true;
		if (coord.x === this.x && coord.y === this.y - 1) return true;
		if (coord.x === this.x && coord.y === this.y + 1) return true;

		return false;
	}
}
window.Coordinate = Coordinate;

class MineMazeNPC {
	/**
	 * NPC object
	 *
	 * @type {object}
	 */
	NPCSlot;

	/**
	 * Location of Entity
	 *
	 * @type {Coordinate}
	 */
	Location;

	/**
	 * How long is the NPC stunned
	 *
	 * @type {number}
	 */
	Stun = 0;

	/**
	 * @returns {object} Cloned NPC Object
	 */
	get NPC() {
		return clone(this.NPCSlot);
	}

	/**
	 * @param {object} NPC Clones passed NPC Object
	 */
	set NPC(NPC) {
		this.NPCSlot = clone(NPC);
	}

	/**
	 * PC_PROXIMITY is how far a guard has to be generated from the PC start position
	 *
	 * @returns {number} Returns PC_PROXIMITY
	 */
	static get PC_PROXIMITY() {
		return 1;
	}

	/**
	 * @param {object} NPC NPC Object
	 * @param {Coordinate} PC PC Location
	 */
	constructor(NPC, PC) {
		this.NPC = NPC;
		this.Location = new Coordinate(MineMaze.MAZE_SIZE, PC, MineMazeNPC.PC_PROXIMITY);
	}

	/**
	 * Moves guard in a random direction
	 */
	move() {
		if (random(1, 5) !== 5) {
			const guardDir = this.Location.possibleDirections(MineMaze.MAZE_SIZE).pluck();
			switch (guardDir) {
				case "up":
					this.Location.up();
					break;
				case "down":
					this.Location.down();
					break;
				case "left":
					this.Location.left();
					break;
				case "right":
					this.Location.right();
					break;
			}
		}
	}
}

class MineMaze {
	/**
	 * Tracks location of PC
	 *
	 * @type {Coordinate}
	 */
	PC;

	/**
	 * Tracks Guards
	 *
	 * @type {MineMazeNPC[]}
	 */
	Guards = [];

	/**
	 * Location of Exit
	 *
	 * @type {Coordinate}
	 */
	Exit;

	/**
	 * Indicies of active guards in combat
	 *
	 * @type {number[]}
	 */
	ActiveGuards = [];

	/**
	 * PC_PROXIMITY is how far exit has to be from the PC start position
	 *
	 * @returns {number} Returns PC_PROXIMITY
	 */
	static get PC_PROXIMITY() {
		return 2;
	}

	/**
	 * MAZE_SIZE is how large the maze is
	 *
	 * @returns {number} Returns MAZE_SIZE
	 */
	static get MAZE_SIZE() {
		return 9;
	}

	/**
	 * @param {object[]} Guards NPC Objects for guards
	 */
	constructor(Guards) {
		this.PC = new Coordinate(MineMaze.MAZE_SIZE);
		Guards.forEach(x => this.Guards.push(new MineMazeNPC(x, this.PC)));
		this.Exit = new Coordinate(MineMaze.MAZE_SIZE, this.PC, MineMaze.PC_PROXIMITY);
	}

	/**
	 * Moves each Guard
	 */
	moveGuards() {
		for (let i = 0; i < this.Guards.length; i++) {
			if (this.Guards[i].Stun === 0) this.Guards[i].move();
		}
	}

	/**
	 * Checks which guards share the same room as PC
	 */
	guardsWithPC() {
		const guards = [];
		for (let i = 0; i < this.Guards.length; i++) {
			if (this.Guards[i].Location.equals(this.PC) && this.Guards[i].Stun === 0) guards.push(i);
		}

		this.ActiveGuards = guards;
	}

	/**
	 * Sets V.NPCList entry for each npc in npcs
	 */
	setNPCSlots() {
		let i = 0;
		this.ActiveGuards.forEach(npc => {
			V.NPCList[i] = this.Guards[npc].NPC;
			i++;
		});
	}

	/**
	 * Ends combat phase
	 */
	combatEnd() {
		const stunDuration = !V.mine.setup.food ? 3 : 6;

		this.ActiveGuards.forEach(npc => {
			this.Guards[npc].Stun = stunDuration;
		});
	}

	/**
	 * Lowers stun level each turn
	 */
	stun() {
		this.Guards.forEach(npc => {
			if (npc.Stun > 0) npc.Stun--;
		});
	}

	/**
	 * Checks if guards are in an adjacent room of PC
	 *
	 * @returns {boolean} Return true if coord is in adjacent room
	 */
	proximityCheck() {
		let check = false;

		this.Guards.forEach(npc => {
			if (this.PC.proximityCheck(npc.Location)) check = true;
		});

		return check;
	}

	/**
	 * Give direction of exit in a triangle pattern
	 */
	lantern() {
		if (this.PC.y === this.Exit.y) {
			return this.PC.x < this.Exit.x ? "right" : "left";
		}
		if (this.PC.x === this.Exit.x) {
			return this.PC.y < this.Exit.y ? "down" : "up";
		}

		const distance = this.PC.y - this.Exit.y;
		if (distance > 0 && this.Exit.x <= this.PC.x + distance && this.Exit.x >= this.PC.x - distance) return "up";
		if (distance < 0 && this.Exit.x >= this.PC.x + distance && this.Exit.x <= this.PC.x - distance) return "down";

		return this.PC.x - this.Exit.x > 0 ? "left" : "right";
	}
}
window.MineMaze = MineMaze;

// Redefines Instance Methods
function resetMazeMethods() {
	resetMineMazeMethods();
	V.mine.maze.Guards.forEach(guard => resetMineMazeNPCMethods(guard));
	resetCoordinateMethods(V.mine.maze.PC);
	resetCoordinateMethods(V.mine.maze.Exit);
}
window.resetMazeMethods = resetMazeMethods;

function resetMineMazeMethods() {
	V.mine.maze.moveGuards = MineMaze.prototype.moveGuards;
	V.mine.maze.guardsWithPC = MineMaze.prototype.guardsWithPC;
	V.mine.maze.setNPCSlots = MineMaze.prototype.setNPCSlots;
	V.mine.maze.combatEnd = MineMaze.prototype.combatEnd;
	V.mine.maze.stun = MineMaze.prototype.stun;
	V.mine.maze.proximityCheck = MineMaze.prototype.proximityCheck;
	V.mine.maze.lantern = MineMaze.prototype.lantern;
}

function resetMineMazeNPCMethods(obj) {
	Object.defineProperty(obj, "NPC", {
		get() {
			return clone(this.NPCSlot);
		},
		set(NPC) {
			this.NPCSlot = clone(NPC);
		},
	});
	obj.move = MineMazeNPC.prototype.move;
	resetCoordinateMethods(obj.Location);
}

function resetCoordinateMethods(obj) {
	obj.equals = Coordinate.prototype.equals;
	obj.proximityGenerator = Coordinate.prototype.proximityGenerator;
	obj.up = Coordinate.prototype.up;
	obj.down = Coordinate.prototype.down;
	obj.left = Coordinate.prototype.left;
	obj.right = Coordinate.prototype.right;
	obj.possibleDirections = Coordinate.prototype.possibleDirections;
	obj.proximityCheck = Coordinate.prototype.proximityCheck;
}
