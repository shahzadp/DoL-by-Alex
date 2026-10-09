declare module "twine-sugarcube" {
	export interface SugarCubeStoryVariables {
		combat: boolean;
		position: 0 | "doggy" | "missionary" | "wall" | "stalk" | "wall";

		walltype?: "pillory" | "cleanpillory" | "horse_pillory" | "wall";
		pilloryaudience?: number;

		arousalmax: number;
		enemyarousal: number;
		enemyarousalmax: number;
		ejaculating: number;
		internalejac: number;
		otherFilled: number;

		orgasmdown: number;
		orgasmcount: number;

		vaginause: number | string;
		anususe: number | string;
		mouth: number | string;
		head: number | string;
		front: number | string;
		back: number | string;
		chest: number | string;
		leftarm: number | string;
		rightarm: number | string;
		leftleg: number | string;
		rightleg: number | string;

		active_enemy: number;
		enemyno: number;
		monster: number;

		anustarget: number;
		anusdoubletarget: number;
		anususe: number;
		anusstate: string | 0;
		bottomtarget: number;
		bottomuse: number;
		bottomstate: string | 0;
		chesttarget: number;
		chestuse: "penis" | 0;
		cheststate: string | 0;
		feettarget: number;
		feetuse: "penis" | 0;
		feetstate: string | 0;
		handtarget: number;
		handuse: number;
		handstate: string | 0;
		lefttarget: number;
		leftuse: number;
		leftstate: string | 0;
		leftaction: string | 0;
		mouthtarget: number;
		mouthuse: number;
		mouthstate: string | 0;
		penistarget: number | "tentacles";
		penisuse: string | 1 | 0;
		penisstate: string | 0;
		righttarget: number;
		rightuse: number;
		rightstate: string | 0;
		rightaction: string | 0;
		stealtarget: number;
		stealuse: number;
		stealstate: string | 0;
		thightarget: number;
		thighuse: "penis" | 0;
		thighstate: string | 0;
		tooltarget: number;
		tooluse: number;
		toolstate: string | 0;
		vaginadoubletarget: number;
		vaginatarget: number;
		vaginause: number;
		vaginastate: string | 0;

		fingersInVagina: number;
		vaginaFingerLimit: number;
		selfsuckDepth: number;
		penisHeight: number;
		corruptionMasturbation: boolean;
		corruptionMasturbationCount: number;
		masturbationorgasmstat: number;
		masturbationOrgasmTimeStat: TimeStamp;
		masturbationorgasm: number;
		masturbationorgasmsemen: number;
		secondsSpentMasturbating: number;
		femaleclimax: number;

		currentToyLeft: any;
		currentToyRight: any;
		currentToyVagina: any;
		currentToyAnus: any;

		prop: string[];
		machine?: MachineStates;
		tentacleColour:
			| "tentacles-blue"
			| "tentacles-vines"
			| "tentacles-roots"
			| "tentacles-red"
			| "tentacles-purple"
			| "tentacles-peach"
			| "tentacles-wraith"
			| "tentacles-wraith-penetrated";
		tentacles: {
			0?: TentacleState;
			1?: TentacleState;
			2?: TentacleState;
			3?: TentacleState;
			4?: TentacleState;
			5?: TentacleState;
			6?: TentacleState;
			7?: TentacleState;
			8?: TentacleState;
			9?: TentacleState;
			10?: TentacleState;
			11?: TentacleState;
			12?: TentacleState;
			13?: TentacleState;
			14?: TentacleState;
			15?: TentacleState;
			16?: TentacleState;
			17?: TentacleState;
			18?: TentacleState;
			19?: TentacleState;
			20?: TentacleState;
			active: number;
			max: number;
		};
		tentacleVagina: string | 0;
		tentacleAnus: string | 0;
		tentaclePenis: string | 0;
		swarm: Swarm;
		speechAdmired?: number;
		speechAnalKiss?: number;
		speechAnalLick?: number;
		speechAnus?: number;
		speechAnusEntrance?: number;
		speechAnusEscape?: number;
		speechAnusImminent?: number;
		speechAnusPenetrated?: number;
		speechAnusVirgin?: number;
		speechAnusWithhold?: number;
		speechApologise?: number;
		speechApologiseRejected?: number;
		speechApologiseUnforgiving?: number;
		speechArms?: number;
		speechAskRough?: number;
		speechBanish?: number;
		speechBottom?: number;
		speechBreastRub?: number;
		speechCameraPose?: number;
		speechChastity?: number;
		speechCheeks?: number;
		speechChestRub?: number;
		speechChoke?: number;
		speechChokedAction?: "apologise" | "askChoke" | "askRough" | "demand" | "moan" | "mock" | "plead" | "scream";
		speechChokedAlready?: number;
		speechChokedMoan?: number;
		speechChokedWheeze?: number;
		speechClit?: number;
		speechCoverFace?: number;
		speechCoverPenis?: number;
		speechCoverVagina?: number;
		speechCrossdressAngry?: number;
		speechCrossdressAroused?: number;
		speechCrossdressDisappointed?: number;
		speechCrossdressShock?: number;
		speechDemand?: number;
		speechDildoAnus?: number;
		speechDildoVagina?: number;
		speechDisable?: number;
		speechExposeBreasts?: number;
		speechExposeGenitals?: number;
		speechFaceSit?: number;
		speechFallenTransform?: number;
		speechFeet?: number;
		speechFencing?: number;
		speechFencingEntrance?: number;
		speechForgive?: number;
		speechFutaPenis?: number;
		speechGlans?: number;
		speechGrowl?: number;
		speechGrowlHeat?: number;
		speechGrowlRut?: number;
		speechHair?: number;
		speechHandjobPenis?: number;
		speechHandjobVagina?: number;
		speechHeadBreasts?: number;
		speechHeadChest?: number;
		speechHeadNipple?: number;
		speechHeadNippleClosed?: number;
		speechHeadSuckle?: number;
		speechHeadSuckleClosed?: number;
		speechHermAngry?: number;
		speechHermAroused?: number;
		speechHermDisappointed?: number;
		speechHermShock?: number;
		speechKissVirgin?: number;
		speechLactate?: number;
		speechLegLock?: number;
		speechLINameDrop?: number;
		speechMasturbate?: number;
		speechMoan?: number;
		speechMouthEntrance?: number;
		speechMouthImminent?: number;
		speechMouthNPCAnus?: number;
		speechMouthNPCVagina?: number;
		speechMouthPenetrated?: number;
		speechNoticeSexToy?: number;
		speechNPCAnusEntrance?: number;
		speechNPCAnusEscape?: number;
		speechNPCAnusImminent?: number;
		speechNPCAnusPenetrated?: number;
		speechNPCAnusVirgin?: number;
		speechNPCAnusWithhold?: number;
		speechNPCChastity?: number;
		speechNPCHandholdingVirgin?: number;
		speechNPCKissVirgin?: number;
		speechNPCOralVirgin?: number;
		speechNPCPenisVirgin?: number;
		speechNPCVaginaEntrance?: number;
		speechNPCVaginaEscape?: number;
		speechNPCVaginaImminent?: number;
		speechNPCVaginaPenetrated?: number;
		speechNPCVaginaVirgin?: number;
		speechNPCVaginaWithhold?: number;
		speechOralVirgin?: number;
		speechPay?: number;
		speechPenis?: number;
		speechPenisBig?: number;
		speechPenisFoot?: number;
		speechPenisSmall?: number;
		speechPenisVirgin?: number;
		speechPepperSpray?: number;
		speechPlayerBeaten?: number;
		speechPlayerHits?: number;
		speechPlayerOrgasm?: number;
		speechPlead?: number;
		speechPregnant?: number;
		speechSaidLines?: Partial<Record<SpeechSpeaker, SpeechHistoryEntry[]>>;
		speechScreamForHelp?: number;
		speechSexToyState?: "aroused" | "neutral" | "disappointed" | "shocked" | "angry";
		speechSpank?: number;
		speechSprayCycle?: number;
		speechSprayCyclePlant?: number;
		speechSteal?: number;
		speechStripStruggle?: number;
		speechStroker?: number;
		speechStruggle?: number;
		speechTempleVirgin?: number;
		speechThigh?: number;
		speechTrib?: number;
		speechTribEntrance?: number;
		speechVagina?: number;
		speechVaginaEntrance?: number;
		speechVaginaEscape?: number;
		speechVaginaFlaunt?: number;
		speechVaginaFoot?: number;
		speechVaginaImminent?: number;
		speechVaginaPenetrated?: number;
		speechVaginaVirgin?: number;
		speechVaginaWithhold?: number;
		whitneyUniqueComments?: string[];
	}

	export interface SugarCubeTemporaryVariables {
		crOverrides?: CombatRendererOverrides;
		noNameComment?: boolean;
		speechPool?: Partial<Record<SpeechSpeaker, SpeechPool>>;
		speechPoolSpeaker?: SpeechSpeaker;
	}

	export interface SugarCubeSetupObject {
		positions: Positions[];
		legPositions: LegPositions[];
		speechCategories: Record<string, { priority: number; cooldown?: number }>;
	}
}

declare global {
	export type Positions = 0 | "doggy" | "missionary" | "wall" | "stalk" | "wall";

	export type LegPositions = "up" | "down" | "footjob";

	export type AnimationSpeed = "vfast" | "fast" | "mid" | "slow" | "idle";

	// There is more to do, look at tentacle-action.twee
	export type ShaftTarget =
		| 0
		| "tummy"
		| "thighs"
		| "breasts"
		| "chest"
		| "waist"
		| "neck"
		| "shoulders"
		| "leftarm"
		| "rightarm"
		| "leftleg"
		| "rightleg"
		| "finished";

	// There is a lot more, look at tentacle-action.twee
	export type HeadTarget =
		| 0
		| "leftarm"
		| "rightarm"
		| "feet"
		| "leftnipplesuck"
		| "rightnipplesuck"
		| "leftnipple"
		| "rightnipple"
		| "penisrub"
		| "finished";

	export interface CombatRendererOverrides {
		legBackPosition?: LegPositions;
		legFrontPosition?: LegPositions;
		animSpeed?: AnimationSpeed;
		animFrames?: number;
	}

	export interface TentacleState {
		baby: number;
		babychance: number;
		desc: string;
		fullDesc: string;
		head: HeadTarget;
		id: string;
		shaft: ShaftTarget;
		size: number;
		tentaclehealth: number;
		tentaclehealthstart: number;
		traits: string[];
		type: "tentacle";
	}

	export interface MachineStates {
		tattoo: MachineState;
		speed: any;
	}

	export interface MachineState {
		health: number;
		hack: number;
		ammo: number;
		armed: 1 | 0;
		state: "ready" | "inert" | "imminent" | "entrance" | "penetrated" | "destroyed";
		use: string;
	}

	export interface Swarm {
		amount: {
			active: number[];
			genital: number[];
			butt: number[];
		};
	}

	export type SpeechSpeaker = NpcNames | "pc";

	export interface SpeechPool {
		lines: SpeechLine[];
		canPass: boolean;
	}

	export interface SpeechLine {
		content: string;
		category: string;
		weight: number;
		id: string;
		reply?: SpeechReply;
	}

	export interface SpeechHistoryEntry {
		id: string | null;
		category: string | null;
	}

	export interface SpeechReply {
		speaker: NpcNames;
		content: string;
	}
}

export {};
