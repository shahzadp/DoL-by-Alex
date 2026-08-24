declare module "twine-sugarcube" {
	export interface SugarCubeStoryVariables {
		pregnancies: Pregnancy[];
		childRecords: Child[];

		cumLoads: {
			vagina: Load[];
			anus: Load[];
		};
		pendingPregnancies: {
			vagina: PendingPregnancy | null;
			anus: PendingPregnancy | null;
		};

		sexStats: SexStats;
	}
}

declare global {
	export interface Pregnancy {
		pregnancyId: number;
		carrier: string;
		carrierSpecies: string;
		donor: string;
		donorSpecies: string;
		possibleDonors: PossibleDonor[];
		conceivedDate: number;
		conceivedLocation: string;
		gestationVariance: number;
		orifice: "vagina" | "anus";
		hatchDelay?: number;
		layCare?: number;
		deliveredDate: number | null;
		deliveredLocation: string | null;
		waterBreaking?: boolean;
		birthInProgress?: boolean;
		termEffectsDone?: boolean;
		ultrasoundDone?: boolean;
		awareOfPregnancy: string[];
		awareOfCarrier: string[];
		awareOfDonor: string[];
		awareOfMultiple?: boolean;
		talkedAbout: Record<string, boolean>;
		playerLearnedFrom: string | null;
	}

	export interface PossibleDonor {
		name: string;
		species: string;
	}

	export interface TrackedNpc {
		source: string;
		type: string;
	}

	export interface ChildParent {
		gender: "m" | "f" | "h" | null;
		hairColour: string | null;
		eyeColour: string | null;
		skinColour: string | null;
	}

	export type DonorSpecies = "human" | "wolf" | "wolfboy" | "wolfgirl" | "hawk" | "harpy";
	export type ChildSpecies = "human" | "wolf" | "hawk";

	export interface Child {
		childId: number;
		pregnancyId: number;
		species: string;
		features: Features;
		gender: "m" | "f" | "h";
		identical: number | null;
		development: Development;
		bornDate: number | null;
		name: string | null;
		coParents: string[];
		awareOfChild: string[];
		awareOfGender: string[];
	}

	export interface Features {
		monster?: "monster";
		size?: string;
		hairColour?: string;
		eyeColour?: string;
		skinColour?: string;
		beastTransform?: "cat" | "cow" | "wolf" | "bird" | "fox" | null;
		divineTransform?: "angel" | "fallen" | "demon" | null;
	}

	export interface Development {
		location?: string;
		birthLocation?: string;
		activity?: string | null;
		event?: boolean;
		activityDay?: number;
		activityHour?: number;
		crawling?: number;
		talking?: number;
		toy?: string | null;
		acceptsDummy?: boolean;
		firstWord?: string | null;
		interactions?: number;
		interactionsTotal?: number;
		adoptedDate?: number;
	}

	export interface Load {
		donor: string;
		donorSpecies: string;
		time: number;
		weight: number;
		canWash: boolean;
		lifespan: number;
		location: string;
		/** The day of the load's own life it last took a conception roll on. Absent until its first roll. */
		rolledDay?: number;
	}

	export interface PendingPregnancy {
		carrierSpecies: string;
		donor: string;
		donorSpecies: string;
		possibleDonors: PossibleDonor[];
		conceivedDate: number;
		conceivedLocation: string;
	}

	export interface Menstruation {
		currentState: "normal" | "recovering" | "pregnant";
		currentDay: number;
		currentDaysMax: number;
		baseDays: number;
		baseDaysRng: number;
		stages: number[];
		fertileLeadDays: number;
		periodEnabled: boolean;
		running: boolean;
		awareOfPeriodDelay: boolean;
		recoveryTime: number;
		recoveryTimeStart: number;
		recoveryStage: number;
	}

	export interface SexStats {
		vagina: { menstruation: Menstruation; [key: string]: any };
		anus: { [key: string]: any };
		[key: string]: any;
	}

	export interface NpcPregnancyCycle {
		enabled: boolean;
		cycleDaysTotal: number;
		cycleDay: number;
		cycleDangerousDay: number;
		fertileLeadDays: number;
		pills: "fertility" | "contraceptive" | null;
	}

	export type MorningAfterPillResult = "notPregnant" | "success" | "aLittleLate" | "late" | "tooLate";

	function pushPregnancyRecord(fields: Partial<Pregnancy>): number;
	function pushChildRecord(fields: Partial<Child>): number;
	function createPregnancy(
		carrier: string,
		carrierSpecies: string,
		donor: string,
		donorSpecies: string,
		possibleDonors: PossibleDonor[],
		conceivedDate: number,
		orifice: "vagina" | "anus",
		conceivedLocation: string
	): number;
	function createChild(pregnancyId: number, species: string, features: Features, gender: "m" | "f" | "h", identical: number | null): number;
	function gestationSeconds(species: string): number;
	function getDueDate(pregnancy: Pregnancy): number;
	function getHatchDate(pregnancy: Pregnancy): number;
	function pregnancyProgress(pregnancy: Pregnancy): number;
	function recordDelivery(pregnancyId: number, deliveredLocation: string): void;
	function recordBirth(childId: number): void;
	function checkLabour(): void;
	function addEggCare(pregnancyId: number, seconds: number): void;

	function setKnowsPregnancy(pregnancyId: number, who: string): void;
	function setPlayerLearnedFrom(pregnancyId: number, source: string): void;
	function setKnowsCarrier(pregnancyId: number, who: string): void;
	function setKnowsDonor(pregnancyId: number, who: string): void;
	function setKnowsChild(childId: number, who: string): void;
	function setKnowsGender(childId: number, who: string): void;
	function knowsPregnancy(pregnancyId: number, who: string): boolean;
	function knowsCarrier(pregnancyId: number, who: string): boolean;
	function knowsDonor(pregnancyId: number, who: string): boolean;
	function knowsChild(childId: number, who: string): boolean;
	function knowsGender(childId: number, who: string): boolean;
	function hasTalkedAbout(pregnancyId: number, who: string): boolean;
	function markTalkedAbout(pregnancyId: number, who: string): void;
	function couldBeDonor(pregnancy: Pregnancy, name: string): boolean;
	function resolvePaternity(pregnancyId: number): void;

	function getActivePregnancy(carrier: string, orifice: "vagina" | "anus"): Pregnancy | undefined;
	function getActivePregnancies(carrier: string): Pregnancy[];
	function getLabouringPregnancy(carrier: string): Pregnancy | undefined;
	function getLabouringLitter(carrier: string): Child[];
	function getPregnancyOf(child: Child): Pregnancy;
	function getChildrenOf(pregnancyId: number): Child[];
	function childIsBorn(child: Child): boolean;
	function childIsUnhatchedEgg(child: Child): boolean;
	function getBornChildren(): Child[];
	function getChildrenAt(location: string): Child[];
	function nestEggCount(): number;
	function childAgeOf(child: Child): number;
	function beginRearing(child: Child, location: string, birthLocation: string): void;
	function birthRecordedLitter(pregnancyId: number, birthLocation: string, location: string): void;

	function migrateChildrenToRecords(): Record<string, number>;
	function applyLegacyPregnancyState(carrier: string, oldBirthId: number, pregnancyId: number): void;
	function migrateChildFeatures(oldFeatures: object): Features;
	function migrateInflightPregnanciesToRecords(): void;
	function migrateNpcInflightPregnanciesToRecords(): void;

	function inseminate(
		orifice: "vagina" | "anus",
		donor: string,
		donorSpecies: string,
		depth: "outside" | "imminent" | "deep",
		location: string,
		potency: number,
		lifespan: number | null
	): Load | null;
	function loadIsLive(load: Load): boolean;
	function trimExpiredLoads(): void;
	function washLoads(): void;
	function hourlyPregnancyUpdate(): void;
	function rollAndRecordConception(orifice: "vagina" | "anus"): void;
	function readyToCarry(): boolean;
	function fertilityOnCycleDay(day: number): number;
	function loadAgeDay(load: Load): number;
	function recordPendingPregnancy(orifice: "vagina" | "anus", load: Load): void;
	function startDuePregnancies(): void;
	function fetishPregnancyRoll(load: Load): Load | null;
	function takeMorningAfterPill(): MorningAfterPillResult;

	function childBaseSpecies(donorSpecies: string): "human" | "wolf" | "hawk";
	function isMonsterPerson(donorSpecies: string): boolean;
	function rollLitterSize(base: string): number;
	function resolveChildParent(name: string): { gender: string | null; hairColour: string | null; eyeColour: string | null; skinColour: string | null };
	function rollChildGender(carrierParent: { gender: string | null }, donorParent: { gender: string | null }, sameParent: boolean): "m" | "f" | "h";
	function pcHeritage(): { beast: string | null; divine: string | null };
	function rollChildEyeColour(carrierParent: { eyeColour: string | null }, donorParent: { eyeColour: string | null }): string;
	function rollChildSkinColour(carrierParent: { skinColour: string | null }, donorParent: { skinColour: string | null }): string;
	function rollChildHairColour(
		base: "human" | "wolf" | "hawk",
		carrierParent: { hairColour: string | null },
		donorParent: { hairColour: string | null },
		wolfFur: string[]
	): string;
	function generateChildren(pregnancyId: number): void;
	function playerKnowsLitterSpecies(pregnancy: Pregnancy): boolean;
	function playerConceivedWith(name: string): boolean;

	function combatInseminate(slot: number, beast?: boolean): Load | null;
	function sceneInseminate(
		orifice: "vagina" | "anus",
		donor: string,
		donorSpecies: string,
		depth: "outside" | "imminent" | "deep",
		quantity?: number,
		days?: number | null
	): Load | null;
	function instantConception(orifice: "vagina" | "anus", load: Load, force?: boolean): void;
	function npcPregnancyRoll(
		carrier: string,
		carrierSpecies: string,
		donor: string,
		donorSpecies: string,
		orifice: "vagina" | "anus",
		depth?: "outside" | "imminent" | "deep",
		location?: string,
		donorFertility?: number
	): number | null;

	function canPlayerConceive(orifice: "vagina" | "anus", donor: string, donorSpecies: string): boolean;
	function canNpcConceive(orifice: "vagina" | "anus", carrier: string, infertile: boolean): boolean;
	function impregnationDisabled(forced: boolean): boolean;
	function playerPregnancyEligible(name: string, species: string, forced: boolean): boolean;
	function playerSpeciesPregnancyEnabled(species: string): boolean;
	function hasExceptionalAnalPregnancy(): boolean;
	function playerCanCarryAnally(): boolean;
	function playerCanBreedWith(NPC: string | object): boolean;
	function pregnancyCompatible(NPC: string | object): boolean;
	function resolvePregnancyNpc(NPC: string | object): { npc: object | null; name: string; named: boolean };
	function playerPregnancyPossibleWith(NPC: string | object): boolean;
	function NPCPregnancyPossibleWithPlayer(NPC: string | object): boolean;
	function orificeHasParasites(orifice: "vagina" | "anus"): boolean;
	function maxParasites(orifice?: "vagina" | "anus"): number;
	function canImpregnateParasite(orifice?: "vagina" | "anus"): boolean;
}

export {};
