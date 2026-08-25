/*
 * The default state machine can be found in fishingMinigameBehaviorDefaults, and is by itself a working behavior, albeit with the most simple possible combat behavior.
 *
 * Each defined behavior overrides parts of how the state machine work, which are broken up into two parts:
 *	1) How the state of the player and the fish changes depending on the action of the player and the fish:
 *		duringRun(playerAction, athleticsSuccess)
 *		duringIdle(playerAction)
 *		duringThrash(playerAction, athleticsSuccess)
 *	Each returning an object that represents how the state should change when the fish chooses that action:
 *     {
 * 			armFatigue: 1,
 * 			fishDistance: 1,
 * 			fishStamina: -1
 * 		}
 *
 * 2): How the state of the player and fish, and the chosen action of the player, affect what action the fish will take next
 * 		nextActionFromIdle(stamina, maxStamina, fishDistance, playerAction)
 * 		nextActionFromThrash(stamina, maxStamina, fishDistance, playerAction)
 * 		nextActionFromReel(stamina, maxStamina, fishDistance, playerAction)
 * 	Each returning an object that represents the odds of the fish choosing which action to take next:
 * 		return [
 *			["run", 10],
 *			["thrash", 20],
 *			["idle", 70],
 *		];
 */
const fishingMinigameBehaviorDefaults = {
	onStart() {},
	duringRun(playerAction, athleticsSuccess) {
		if (playerAction === "reel") {
			if (athleticsSuccess) {
				return {
					armFatigue: [0, 1, 1].random(),
					fishDistance: [0, -1].random(),
					fishStamina: -1,
				};
			} else {
				return {
					armFatigue: 1,
					fishDistance: 1,
					fishStamina: -1,
				};
			}
		} else if (playerAction === "hold") {
			if (athleticsSuccess) {
				return {
					armFatigue: [0, 1].random(),
					fishDistance: 0,
					fishStamina: -1,
				};
			} else {
				return {
					armFatigue: [0, 1].random(),
					fishDistance: 1,
					fishStamina: -1,
				};
			}
		} else if (playerAction === "slack") {
			return {
				armFatigue: 0,
				fishDistance: 2,
				fishStamina: -1,
			};
		}
		throw new Error(`duringRun: unexpected playerAction "${playerAction}"`);
	},
	duringIdle(playerAction) {
		if (playerAction === "reel") {
			return {
				armFatigue: 0,
				fishDistance: -1,
				fishStamina: 1,
			};
		} else if (playerAction === "hold" || playerAction === "slack") {
			return {
				armFatigue: 0,
				fishDistance: 0,
				fishStamina: 1,
			};
		}
		throw new Error(`duringIdle: unexpected playerAction "${playerAction}"`);
	},
	duringThrash(playerAction, athleticsSuccess) {
		if (playerAction === "reel") {
			if (athleticsSuccess) {
				return {
					armFatigue: [0, 0, 1].random(),
					fishDistance: -1,
					fishStamina: 0,
				};
			} else {
				return {
					armFatigue: [0, 0, 1].random(),
					fishDistance: 0,
					fishStamina: 0,
				};
			}
		} else if (playerAction === "hold") {
			if (athleticsSuccess) {
				return {
					armFatigue: 0,
					fishDistance: 0,
					fishStamina: [0, -1].random(),
				};
			} else {
				return {
					armFatigue: 0,
					fishDistance: 0,
					fishStamina: [0, -1].random(),
				};
			}
		} else if (playerAction === "slack") {
			return {
				armFatigue: 0,
				fishDistance: 0,
				fishStamina: [0, -1].random(),
			};
		}
		throw new Error(`duringThrash: unexpected playerAction "${playerAction}"`);
	},
	nextActionFromIdle(stamina, maxStamina, _fishDistance, _playerAction) {
		if (stamina < maxStamina) {
			return [["idle", 100]];
		} else {
			return [["run", 100]];
		}
	},
	nextActionFromRun(stamina, _maxStamina, _fishDistance, _playerAction) {
		if (stamina <= 0) {
			return [["idle", 100]];
		} else {
			return [["run", 100]];
		}
	},
};

setup.fishingMinigame = {
	behaviors: {
		/*
		 * Behavior: Runs. Holding during a run can drain an extra point of stamina.
		 *
		 * To win: Hold during runs until its stamina reaches 0.
		 */
		runner: Object.assign(Object.create(fishingMinigameBehaviorDefaults), {
			initialAction: "run",
			duringRun(playerAction, _athleticsSuccess) {
				if (playerAction === "hold") {
					return {
						fishStamina: [-1, -2].random(),
					};
				}
				return {};
			},
		}),
		/*
		 * Behavior: Runs while far out, draining extra stamina when you hold or reel. Once it's close to shore it panics and thrashes instead of running.
		 *
		 * To win: Wear its stamina down during runs as you bring it in, then reel during its thrashing once it's close.
		 */
		panicked: Object.assign(Object.create(fishingMinigameBehaviorDefaults), {
			initialAction: "run",
			duringRun(playerAction, _athleticsSuccess) {
				if (playerAction === "hold" || playerAction === "reel") {
					return {
						fishStamina: [-1, -2].random(),
					};
				}
				return {};
			},
			duringThrash(_playerAction, athleticsSuccess) {
				if (athleticsSuccess) {
					return {
						fishStamina: [-1, -2].random(),
					};
				} else {
					return {
						fishStamina: [0, -1].random(),
					};
				}
			},
			nextActionFromRun(stamina, _maxStamina, fishDistance, _playerAction) {
				if (stamina <= 0) {
					return [["idle", 100]];
				}
				if (fishDistance <= 2) {
					return [["thrash", 100]];
				}
				return [["run", 100]];
			},
			nextActionFromIdle(stamina, maxStamina, fishDistance, _playerAction) {
				if (stamina < maxStamina) {
					return [["idle", 100]];
				}

				if (fishDistance <= 2) {
					return [["thrash", 100]];
				}
				return [["run", 100]];
			},
			nextActionFromThrash(stamina, _maxStamina, fishDistance, _playerAction) {
				if (fishDistance <= 2) {
					if (stamina > 0) {
						return [
							["thrash", 70],
							["idle", 20],
							["run", 10],
						];
					}
					return [
						["idle", 80],
						["thrash", 20],
					];
				}
				if (stamina > 0) {
					return [
						["run", 70],
						["idle", 20],
						["thrash", 10],
					];
				}
				return [
					["idle", 80],
					["thrash", 20],
				];
			},
		}),
		/*
		 * Behavior: Runs in short bursts of about 2 turns, darting 1-2 distance away each turn, then stops to rest before bursting again.
		 *
		 * To win: Wait out its running bursts, then reel it in while it's idle.
		 */
		darter: Object.assign(Object.create(fishingMinigameBehaviorDefaults), {
			initialAction: "run",
			duringRun(playerAction, athleticsSuccess) {
				if (playerAction === "reel") {
					if (athleticsSuccess) {
						return {
							fishStamina: -3,
							fishDistance: [0, 1].random(),
						};
					} else {
						return {
							fishDistance: 1,
						};
					}
				} else if (playerAction === "hold") {
					if (athleticsSuccess) {
						return {
							fishStamina: -3,
							fishDistance: 1,
						};
					} else {
						return {
							fishDistance: 2,
						};
					}
				} else if (playerAction === "slack") {
					return {
						fishDistance: [2, 3].random(),
					};
				}
			},
			duringIdle(_playerAction) {
				return {
					fishStamina: [0, 1, 1].random(),
				};
			},
			nextActionFromRun(stamina, _maxStamina, _fishDistance, _playerAction) {
				if (stamina <= 0) {
					return [["idle", 100]];
				}

				if (stamina <= 3) {
					return [
						["run", 60],
						["idle", 40],
					];
				} else {
					return [
						["run", 50],
						["idle", 50],
					];
				}
			},
			nextActionFromIdle(stamina, maxStamina, _fishDistance, _playerAction) {
				if (stamina <= 1) {
					return [["idle", 100]];
				} else if (stamina === maxStamina) {
					return [["run", 100]];
				}

				return [
					["idle", 75],
					["run", 25],
				];
			},
		}),
		/*
		 * Behavior: Starts thrashing and will run at least once before it can be landed. Hold or reel during a thrash drains its stamina on a success but restores 0-2 on a failure. Reel during a thrash or an idle closes distance. Reeling or holding while it idles before it has run makes it bolt into a run, during which its distance climbs and its stamina barely drops.
		 *
		 * To win: Reel during its thrashes to drain stamina and close distance, accepting that it will run at least once. Avoid reeling or holding while it sits idle before its run, or it will bolt.
		 */
		thrasher: Object.assign(Object.create(fishingMinigameBehaviorDefaults), {
			initialAction: "thrash",
			onStart() {
				console.log("why");
				V.thrasherHasRan = false;
			},
			duringThrash(playerAction, athleticsSuccess) {
				if (playerAction === "hold" || playerAction === "reel") {
					if (athleticsSuccess) {
						return {
							fishStamina: [0, -1].random(),
						};
					} else {
						return {
							fishStamina: [0, 1, 2].random(),
						};
					}
				}

				return {};
			},
			duringIdle(playerAction) {
				if (playerAction === "reel") {
					return {
						fishDistance: [-1, -2].random(),
						fishStamina: 1,
					};
				} else {
					return {
						fishStamina: 1,
					};
				}
			},
			duringRun(_playerAction, athleticsSuccess) {
				V.thrasherHasRan = true;
				if (athleticsSuccess) {
					return {
						fishDistance: 1,
						fishStamina: [0, -1].random(),
					};
				} else {
					return {
						fishDistance: [1, 2].random(),
						fishStamina: [0, -1].random(),
					};
				}
			},
			nextActionFromRun(stamina, _maxStamina, _fishDistance, _playerAction) {
				if (stamina <= 0) {
					return [["thrash", 100]];
				}

				return [
					["run", 90],
					["thrash", 10],
				];
			},
			nextActionFromIdle(stamina, _maxStamina, _fishDistance, playerAction) {
				if (stamina === 0) {
					return [
						["thrash", 70],
						["idle", 30],
					];
				}

				if (playerAction === "hold" || playerAction === "reel") {
					if (V.thrasherHasRan) {
						return [
							["thrash", 70],
							["run", 30],
						];
					}

					return [["run", 100]];
				} else {
					return [
						["thrash", 70],
						["idle", 30],
					];
				}
			},
			nextActionFromThrash(stamina, _maxStamina, fishDistance, playerAction) {
				if (stamina <= 0) {
					return [
						["thrash", 60],
						["idle", 40],
					];
				}

				if (fishDistance <= 2 && !V.thrasherHasRan) {
					return [["run", 100]];
				}

				if (playerAction === "slack") {
					if (!V.thrasherHasRan) {
						return [["run", 100]];
					} else {
						return [
							["thrash", 70],
							["run", 30],
						];
					}
				} else if (playerAction === "hold" || playerAction === "reel") {
					return [
						["thrash", 50],
						["idle", 50],
					];
				}
			},
		}),
		/*
		 * Behavior: Thrashes randomly, hold to turn a thrash into an idle. If it gets too close while not thrashing or with stamina, it will run a long distance. Will occasionally run a short distance otherwise.
		 *
		 * To win: Reel it in and try to make sure it has low stamina when it gets close to the shore to prevent it from running.
		 */
		slipper: Object.assign(Object.create(fishingMinigameBehaviorDefaults), {
			initialAction: "idle",
			onStart() {
				V.slipperBigRun = false;
			},
			duringRun(playerAction, athleticsSuccess) {
				if (V.slipperBigRun) {
					V.slipperBigRun = false;
					if (playerAction === "reel") {
						if (athleticsSuccess) {
							return {
								fishStamina: -2,
								fishDistance: 3,
							};
						} else {
							return {
								fishStamina: -2,
								fishDistance: [4, 5].random(),
							};
						}
					} else if (playerAction === "hold") {
						if (athleticsSuccess) {
							return {
								fishStamina: -2,
								fishDistance: [3, 4].random(),
							};
						} else {
							return {
								fishStamina: -2,
								fishDistance: [4, 5].random(),
							};
						}
					} else if (playerAction === "slack") {
						return {
							fishStamina: -2,
							fishDistance: [4, 5].random(),
						};
					}
				} else {
					if (playerAction === "reel") {
						if (athleticsSuccess) {
							return {
								fishDistance: [0, -1].random(),
							};
						} else {
							return {
								fishDistance: 1,
							};
						}
					} else if (playerAction === "hold") {
						if (athleticsSuccess) {
							return {
								fishDistance: 0,
							};
						} else {
							return {
								fishDistance: 1,
							};
						}
					} else if (playerAction === "slack") {
						return {
							fishDistance: 1,
						};
					}
				}
			},
			duringIdle(_playerAction) {
				return {
					fishStamina: [0, 0, 1].random(),
				};
			},
			duringThrash(_playerAction, athleticsSuccess) {
				if (athleticsSuccess) {
					return {
						fishStamina: -1,
					};
				}
			},
			nextActionFromIdle(stamina, maxStamina, fishDistance, playerAction) {
				if (stamina <= 0) {
					return [
						["idle", 30],
						["thrash", 70],
					];
				}

				if (fishDistance <= 3) {
					V.slipperBigRun = true;
					if (playerAction === "hold") {
						return [
							["run", 30],
							["thrash", 70],
						];
					} else {
						if (stamina >= 4) {
							return [["run", 100]];
						} else if (stamina >= 3) {
							return [
								["run", 80],
								["thrash", 20],
							];
						} else if (stamina >= 2) {
							return [
								["run", 60],
								["thrash", 40],
							];
						} else if (stamina >= 1) {
							return [
								["run", 40],
								["thrash", 60],
							];
						}
					}
				}

				if (stamina > 0) {
					return [
						["idle", 40],
						["run", 40],
						["thrash", 20],
					];
				}

				return [["idle", 100]];
			},
			nextActionFromThrash(stamina, _maxStamina, fishDistance, playerAction) {
				if (playerAction === "hold") {
					return [["idle", 100]];
				} else if (playerAction === "slack") {
					if (stamina <= 0) {
						return [
							["idle", 30],
							["thrash", 70],
						];
					} else {
						return [
							["run", 40],
							["idle", 60],
						];
					}
				}

				if (stamina <= 0) {
					return [
						["idle", 30],
						["thrash", 70],
					];
				}

				if (fishDistance <= 3) {
					return [
						["thrash", 80],
						["idle", 20],
					];
				} else {
					return [
						["thrash", 40],
						["idle", 40],
						["run", 20],
					];
				}
			},
		}),
		/*
		 * Behavior: Runs. Reel and hold during a run both add heavy arm fatigue and drain a lot of its stamina. At 0 stamina it thrashes, and it lingers in idle to recover. Slack during a run only gains 1 distance.
		 *
		 * To win: Hold during runs, avoid reeling until it thrashes. Reel during the thrash to close distance. Distance increases slower while running, so slack isn't that bad if it's running.
		 */
		anchor: Object.assign(Object.create(fishingMinigameBehaviorDefaults), {
			initialAction: "run",
			duringRun(playerAction, athleticsSuccess) {
				if (playerAction === "reel") {
					if (athleticsSuccess) {
						return {
							armFatigue: [2, 3].random(),
							fishDistance: -1,
							fishStamina: [-1, -2].random(),
						};
					} else {
						return {
							armFatigue: [2, 3].random(),
							fishDistance: [0, 1].random(),
							fishStamina: [-1, -2].random(),
						};
					}
				} else if (playerAction === "hold") {
					if (athleticsSuccess) {
						return {
							armFatigue: [2, 3].random(),
							fishDistance: 0,
							fishStamina: [-1, -2].random(),
						};
					} else {
						return {
							armFatigue: [2, 3].random(),
							fishDistance: [0, 1].random(),

							fishStamina: [-1, -2].random(),
						};
					}
				} else if (playerAction === "slack") {
					return {
						fishDistance: 1,
						fishStamina: -2,
					};
				}
			},
			duringThrash(playerAction, athleticsSuccess) {
				if (playerAction === "reel") {
					if (athleticsSuccess) {
						return {
							armFatigue: 1,
							fishStamina: [-1, -2].random(),
							fishDistance: -1,
						};
					} else {
						return {
							armFatigue: 1,
							fishStamina: [0, 0, 1].random(),
						};
					}
				} else if (playerAction === "hold") {
					if (athleticsSuccess) {
						return {
							armFatigue: 1,
							fishStamina: [-1, -2].random(),
						};
					} else {
						return {
							armFatigue: 1,
							fishStamina: [0, 0, 1].random(),
						};
					}
				} else if (playerAction === "slack") {
					return {
						fishStamina: -1,
					};
				}
			},
			nextActionFromRun(stamina, _maxStamina, _fishDistance, _playerAction) {
				if (stamina <= 0) {
					return [["thrash", 100]];
				}

				return [["run", 100]];
			},
			nextActionFromIdle(stamina, _maxStamina, _fishDistance, _playerAction) {
				if (stamina <= 0) {
					return [
						["thrash", 30],
						["idle", 70],
					];
				} else {
					return [
						["run", 30],
						["idle", 70],
					];
				}
			},
			nextActionFromThrash(stamina, _maxStamina, _fishDistance, playerAction) {
				if (stamina > 0) {
					return [
						["thrash", 30],
						["run", 70],
					];
				}
				if (playerAction === "reel" || playerAction === "slack") {
					return [
						["idle", 80],
						["thrash", 20],
					];
				} else if (playerAction === "hold") {
					return [["thrash", 100]];
				}
			},
		}),
	},
};

/**
 * Initializes the fishing minigame state.
 *
 * @param {string} fishKey
 */
function fishingMinigameStart(fishKey) {
	const minigame = setup.fishing.lootTables.fish[fishKey].minigame;
	V.fishingMinigame = {
		fishName: fishKey,
		behavior: minigame.behavior,
		maxStamina: minigame.maxStamina,
		fishStamina: minigame.maxStamina,
		fishDistance: 5,
		fishEscapeTimer: 15,
		fishAction: setup.fishingMinigame.behaviors[minigame.behavior].initialAction,
		armFatigue: 0,
		armFatigueDifficulty: minigame.armFatigueDifficulty,
	};

	if (V.debug === 1) {
		fishingMinigameValidateBehavior(minigame.behavior, setup.fishingMinigame.behaviors[minigame.behavior], minigame.maxStamina);
	}

	setup.fishingMinigame.behaviors[minigame.behavior].onStart();
}
window.fishingMinigameStart = fishingMinigameStart;

/**
 * Whether the given player action against the fish's current action requires an athletics check.
 *
 * @param {string} playerAction
 * @returns {boolean}
 */
function fishingMinigameActionRequiresAthletics(playerAction) {
	const fishAction = V.fishingMinigame.fishAction;
	if (fishAction === "run" || fishAction === "thrash") {
		if (playerAction === "reel" || playerAction === "hold") {
			return true;
		}
		if (playerAction === "slack") {
			return false;
		}
		throw new Error(`fishingMinigameActionRequiresAthletics: unexpected action "${playerAction}"`);
	}
	if (fishAction === "idle") {
		if (playerAction === "reel" || playerAction === "hold" || playerAction === "slack") {
			return false;
		}
		throw new Error(`fishingMinigameActionRequiresAthletics: unexpected action "${playerAction}"`);
	}
	throw new Error(`fishingMinigameActionRequiresAthletics: unexpected fishAction "${fishAction}"`);
}
window.fishingMinigameActionRequiresAthletics = fishingMinigameActionRequiresAthletics;

/**
 * Returns the maximum of the athletics roll range for the given action.
 *
 * The numbers for the athletics checks are so large because we don't want athletics to play such a huge roll in the fishing minigame checks. High athletics shouldn't allow the player to just spam reel and catch any fish, that's uninteresting. Though better athletics should help a bit, so it can't just be a flat roll, it needs to use the athletics difficulty system.
 *
 * @param {string} playerAction
 * @returns {number} The upper bound of the athletics check.
 */
function fishingMinigameAthleticsCheckDifficulty(playerAction) {
	const minigame = V.fishingMinigame;
	let base;
	if (minigame.fishAction === "run") {
		if (playerAction === "reel") {
			base = 3500;
		} else if (playerAction === "hold") {
			base = 2500;
		} else {
			throw new Error(`fishingMinigameAthleticsCheckDifficulty: unexpected action "${playerAction}" for a running fish`);
		}
	} else if (minigame.fishAction === "thrash") {
		if (playerAction === "reel") {
			base = 2900;
		} else if (playerAction === "hold") {
			base = 2300;
		} else {
			throw new Error(`fishingMinigameAthleticsCheckDifficulty: unexpected action "${playerAction}" for a thrashing fish`);
		}
	} else {
		throw new Error(`fishingMinigameAthleticsCheckDifficulty: unexpected fishAction "${minigame.fishAction}"`);
	}

	// So the player can be more successful when reeling in close fish. It feels better for the player.
	if (minigame.fishDistance <= 2) {
		base *= (minigame.fishDistance - 2) / 5 + 1;
	}

	if (minigame.fishStamina === minigame.maxStamina) {
		return base + minigame.armFatigue * minigame.armFatigueDifficulty + 2000;
	}
	return base + minigame.armFatigue * minigame.armFatigueDifficulty + 200 * (minigame.fishStamina - minigame.maxStamina);
}
window.fishingMinigameAthleticsCheckDifficulty = fishingMinigameAthleticsCheckDifficulty;

/**
 * Gets the status of the minigame at the start of a turn to decide what should happen on that turn
 *
 * @returns {"start"|"caught"|"fighting"|"fishTooFar"|"lineSnapped"}
 */
function fishingMinigameState() {
	const minigame = V.fishingMinigame;
	if (minigame.fishDistance <= 0) {
		return "caught";
	} else if (minigame.fishDistance > 10) {
		return "fishTooFar";
	} else if (minigame.fishEscapeTimer <= 0) {
		return "lineSnapped";
	} else if (V.fishingMinigame.lastFishAction) {
		return "fighting";
	} else {
		return "start";
	}
}
window.fishingMinigameState = fishingMinigameState;

/**
 * Resolves the current fishing turn
 *
 * @param {string} playerAction
 */
function fishingMinigameResolveTurn(playerAction) {
	V.fishingMinigame.lastPlayerAction = playerAction;

	updateStateFromPlayerActions(playerAction);
	updateArmFatigue(playerAction);
	decrementFishingTimer(playerAction);
	advanceFishTurn(playerAction);
}
window.fishingMinigameResolveTurn = fishingMinigameResolveTurn;

/**
 * @param {string} playerAction
 */
function updateArmFatigue(playerAction) {
	const minigame = V.fishingMinigame;
	if (!fishingMinigameActionRequiresAthletics(playerAction)) {
		minigame.armFatigue = Math.max(0, minigame.armFatigue - 1);
	}
}
window.updateArmFatigue = updateArmFatigue;

/**
 * The timer should stop the fish combat from lasting too long, but it shouldn't stop the player if they are about to win, or if the fish is not moving.
 *
 * @param {string} playerAction
 */
function decrementFishingTimer(playerAction) {
	const minigame = V.fishingMinigame;
	if (minigame.fishDistance >= 2) {
		if (minigame.fishAction !== "idle" && minigame.lastFishAction !== "idle") {
			minigame.fishEscapeTimer -= 1;
		}

		if (fishingMinigameActionRequiresAthletics(playerAction) && !V.athleticsSuccess) {
			minigame.fishEscapeTimer -= 1.2;
		}
	} else {
		minigame.fishEscapeTimer -= 0.25;

		if (fishingMinigameActionRequiresAthletics(playerAction) && !V.athleticsSuccess) {
			minigame.fishEscapeTimer -= 0.25;
		}
	}

	minigame.fishEscapeTimer = Math.round(minigame.fishEscapeTimer * 100) / 100;
}
window.decrementFishingTimer = decrementFishingTimer;

/**
 * Applies the state changes from the players action.
 *
 * @param {string} playerAction
 */
function updateStateFromPlayerActions(playerAction) {
	const minigame = V.fishingMinigame;
	const behavior = setup.fishingMinigame.behaviors[minigame.behavior];

	let result;
	if (minigame.fishAction === "run") {
		result = {
			...fishingMinigameBehaviorDefaults.duringRun(playerAction, V.athleticsSuccess),
			...behavior.duringRun(playerAction, V.athleticsSuccess),
		};
	} else if (minigame.fishAction === "idle") {
		result = {
			...fishingMinigameBehaviorDefaults.duringIdle(playerAction),
			...behavior.duringIdle(playerAction),
		};
	} else if (minigame.fishAction === "thrash") {
		result = {
			...fishingMinigameBehaviorDefaults.duringThrash(playerAction, V.athleticsSuccess),
			...behavior.duringThrash(playerAction, V.athleticsSuccess),
		};
	} else {
		throw new Error(`updateStateFromPlayerActions: unexpected fishAction "${minigame.fishAction}"`);
	}

	minigame.armFatigue += result.armFatigue;
	minigame.fishDistance += result.fishDistance;
	minigame.fishStamina = Math.clamp(minigame.fishStamina + result.fishStamina, 0, minigame.maxStamina);
}

/**
 * Advances the fish one step through its behavior state machine
 *
 * @param {string} playerAction
 */
function advanceFishTurn(playerAction) {
	const minigame = V.fishingMinigame;
	const behavior = setup.fishingMinigame.behaviors[minigame.behavior];

	minigame.lastFishAction = minigame.fishAction;

	let transitions;
	if (minigame.lastFishAction === "run") {
		transitions = behavior.nextActionFromRun(minigame.fishStamina, minigame.maxStamina, minigame.fishDistance, playerAction);
	} else if (minigame.lastFishAction === "idle") {
		transitions = behavior.nextActionFromIdle(minigame.fishStamina, minigame.maxStamina, minigame.fishDistance, playerAction);
	} else if (minigame.lastFishAction === "thrash") {
		transitions = behavior.nextActionFromThrash(minigame.fishStamina, minigame.maxStamina, minigame.fishDistance, playerAction);
	} else {
		throw new Error(`advanceFishTurn: unexpected lastFishAction "${minigame.lastFishAction}"`);
	}
	minigame.fishAction = weightedRandom(...transitions);
}

function fishingMinigameEnd() {
	delete V.fishingMinigame;
}
window.fishingMinigameEnd = fishingMinigameEnd;

/**
 * Loops through every possible state of a given behavior to ensure that there are no invalid states and that the behavior follows a set of rules:
 *
 * 1) If the fish has 0 stamina, then it cannot ever chose to run as its next action.
 * 2) At no point can there be an empty list of next fish actions
 *
 * @param {string} behaviorName
 * @param {object} behavior
 * @param {number} maxStamina
 */
function fishingMinigameValidateBehavior(behaviorName, behavior, maxStamina) {
	const states = ["Run", "Idle", "Thrash"];
	const playerActions = ["reel", "hold", "slack"];
	const validActions = ["run", "idle", "thrash"];
	const maxDistance = 12;

	for (const state of states) {
		const nextActionFromFunction = behavior[`nextActionFrom${state}`];
		if (typeof nextActionFromFunction !== "function") continue;
		for (let stamina = 0; stamina <= maxStamina; stamina++) {
			for (let distance = 0; distance <= maxDistance; distance++) {
				for (const playerAction of playerActions) {
					const scenario = `behavior "${behaviorName}", nextActionFrom${state}(stamina ${stamina}/${maxStamina}, distance ${distance}, "${playerAction}")`;

					const transitions = nextActionFromFunction.call(behavior, stamina, maxStamina, distance, playerAction);
					if (!Array.isArray(transitions) || transitions.length === 0) {
						throw new Error(`Fishing minigame: ${scenario} returned no transitions`);
					}

					for (const [action, weight] of transitions) {
						if (!validActions.includes(action)) {
							throw new Error(`Fishing minigame: ${scenario} returned unknown action "${action}".`);
						}
						if (action === "run" && stamina === 0 && weight > 0) {
							throw new Error(`Fishing minigame: ${scenario} can transition to "run" at 0 stamina. A fish should never run with 0 stamina`);
						}
					}
				}
			}
		}
	}
}
window.fishingMinigameValidateBehavior = fishingMinigameValidateBehavior;

/**
 * Calculates the number of water blocks to be displayed while in the fishing minigame each time the page loads. This is far simpler than making the minigame fully responsive, something that the minigame doesn't really need.
 *
 * @returns {number}
 */
function fishingMinigameBlockCount() {
	return Math.clamp(Math.floor(window.innerWidth / 64) - 2, 1, 10);
}
window.fishingMinigameBlockCount = fishingMinigameBlockCount;
