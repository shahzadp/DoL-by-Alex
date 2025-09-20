import { SugarCubeStoryVariables, SugarCubeTemporaryVariables } from "twine-sugarcube";

declare global {
	export type NpcNames =
		| "Avery"
		| "Bailey"
		| "Briar"
		| "Charlie"
		| "Darryl"
		| "Doren"
		| "Eden"
		| "Gwylan"
		| "Harper"
		| "Jordan"
		| "Kylar"
		| "Landry"
		| "Leighton"
		| "Mason"
		| "Morgan"
		| "River"
		| "Robin"
		| "Sam"
		| "Sirris"
		| "Whitney"
		| "Winter"
		| "Black Wolf"
		| "Niki"
		| "Quinn"
		| "Remy"
		| "Alex"
		| "Great Hawk"
		| "Wren"
		| "Sydney"
		| "Ivory Wraith"
		| "Zephyr";

	const V: SugarCubeStoryVariables;
	const T: SugarCubeTemporaryVariables;
	const C: {
		crime: any;
		npc: {
			[key in NpcNames]: Npc;
		};
		tiredness: {
			max: number;
		};
	};
	const DOL: {
		Stack: string[];
	};
	const EventSystem: EventData;

	const Browser: {
		isMobile: {
			any(): boolean;
		};
	};

	const L10n: any;

	/**
	 * Returns a pseudo-random whole number (integer) within the range of the given bounds (inclusive)—i.e. [min, max].
	 *
	 * NOTE: By default, it uses State.random() as its source of randomness, this is different than vanilla sc2
	 * @param min The lower bound of the random number (inclusive). If omitted, will default to 0.
	 * @param max The upper bound of the random number (inclusive).
	 * @param useMath Use Math.random instead of State.random.
	 * @since 2.0.0
	 * @example
	 * random(5) // Returns a number in the range 0–5
	 * random(1, 6) // Returns a number in the range 1–6
	 * random(1, 6, true) // Returns a number in the range 1–6 without affecting the State
	 */
	function random(minOrMax: number, max?: number, useMath?: boolean): number;

	let throwError: Function;

	let DefineMacro: Function;

	interface ObjectConstructor {
		hasOwn(object: any, property: any): boolean;
		deepMerge(objects: any): object;
		find(objects: any): object;
	}

	interface NumberConstructor {
		shuffle();
		select(index: number): any;
		except(): any;
		formatList(options: any): any;
	}

	interface ArrayConstructor {
		between(min: number, max: number): boolean;
	}
}

export {};
