class ClothesItem {

	/* Index of Clothing | REQUIRED | MUST BE UNIQUE TO SLOT | INT */
	index;

	/* Clothing Slot | REQUIRED | STRING */
	slot;

	/* Lowercase name of clothing | REQUIRED | STRING */
	name;

	/* Capitalized name of clothing | AUTOFILL | STRING */
	name_cap;

	/* Clothing name for variable purpose | REQUIRED | MUST BE UNIQUE | STRING */
	variable;

	/* Integrity of clothing | INT */
	integrity = 100;

	/* Maximum Integrity of clothing | SHOULD BE THE SAME AS INTEGRITY | INT */
	integrity_max = 100;

	/* */
	fabric_strength;

	/* */
	reveal;

	/* */
	bustresize;

	/* */
	word;

	/* Does clothing have multiple parts? | AUTOFILL | INT */
	one_piece = 0;

	/* */
	strap;

	/* */
	open;

	/* */
	state;

	/* */
	state_base;

	/* */
	state_top;

	/* */
	state_top_base;

	/* */
	plural;

	/* */
	colour;

	/* */
	colour_options;

	/* */
	exposed = 0;

	/* */
	exposed_base = 0;

	/* */
	type;

	/* Clothing set | AUTOFILL | STRING */
	set;

	/* Gender of the clothing | REQUIRED | STRING */
	gender;

	/* Warmth value of clothing | INT */
	warmth = 0;

	/* Clothing cost | INT */
	cost = 10000;

	/* Clothing description | REQUIRED | STRING */
	description;

	/* */
	shop;

	/* */
	accessory;

	/* */
	accessory_colour;

	/* */
	accessory_colour_options;

	/* */
	sleeve_img;

	/* */
	breast_img;

	/* Is the clothing cursed? | INT */
	cursed = 0;

	/* */
	location;

	/* */
	iconFile;

	/* */
	accIcon;

	/* */
	mainImage;

	/* */
	notuck;

	/* */
	pregType;

	/* */
	combat;

	/* */
	colour_sidebar;

	/* */
	femininity;

	/* */
	shopGroup;

	/* */
	outfitPrimary;

	/* */
	outfitSecondary;

	/* */
	mask_img;

	/* */
	accessory_colour_combat;

	/* */
	accessory_colour_sidebar;

	/* */
	colour_combat;

	/* */
	formfitting;

	/* */
	pattern;

	/* */
	pattern_options;

	/* */
	pattern_layer;

	/* */
	accessory_integrity_img;

	/* */
	accessory_layer_under;

	/* */
	altposition;

	/* */
	altdisabled;

	/* */
	breast_combat;

	/* */
	breast_acc_img;

	/* */
	altsleeve;

	/* */
	has_collar;

	/* */
	pattern_caption;

	/* */
	sleeve_colour;

	/* */
	sleeve_acc_img;

	/* */
	detailIcon;

	/* */
	hoodposition;

	/* */
	breast_pattern;

	/* */
	zIndex;

	/* */
	back_img;

	/* */
	holdPosition;

	/* */
	back_img_colour;

	/* */
	back_integrity_img;

	/* */
	rearresize;

	/* */
	skirt;

	/* */
	skirt_down;

	/* */
	short;

	/* */
	vagina_exposed;

	/* */
	vagina_exposed_base;

	/* */
	anus_exposed;

	/* */
	anus_exposed_base;

	/* */
	high_img;

	/* */
	back_img_acc;

	/* */
	back_img_acc_colour;

	/* */
	oldVariable;

	/* */
	accImage;

	/* */
	name_simple;

	/* */
	anal_shield;

	/* */
	penis_img;

	/* */
	no_aside;

	/* */
	penis_acc_img;

	/* */
	hideUnderLower;

	/* */
	size;

	/* */
	mask_img_ponytail;

	/* */
	head_type;

	/* */
	hood;

	/* */
	collared;

	/* */
	leftImage;

	/* */
	rightImage;

	/* */
	coverBackImage;

	/* */
	altDamage;

	/* */
	penisSize;


	constructor(props) {
		/* parses passed object and populates class properties */
		Object.keys(props).forEach(prop => {
			this[prop] = props[prop];
		});
		
		/* cleans up unused properties */
		Object.keys(this).forEach(key => {
			if(this[key] === undefined) delete this[key];
		});
		
		/* autofill properties */
		if(this.name && !this.name_cap) this.name_cap = this.name.substring(0,1).toUpperCase() + this.name.slice(1);
		if(this.slot && this.name && !this.set) this.set = this.outfitPrimary || this.outfitSecondary ? this.name : this.slot
		if(!this.one_piece) this.one_piece = this.outfitPrimary || this.outfitSecondary ? 1 : 0;
	}
}

window.ClothesItem = ClothesItem;
