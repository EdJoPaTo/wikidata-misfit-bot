export const CATEGORIES = {
	computer: 'Q68',
	enterprise: 'Q6881511',
	fiction: 'Q14897293',
	food: 'Q2095',
	game: 'Q11410',
	instrument: 'Q34379',
	motion: 'Q79782',
	performingArts: 'Q184485',
	plant: 'Q756',
	socialInteraction: 'Q609298',
	spacecraft: 'Q40218',
	vehicle: 'Q42889',
	visualArt: 'Q36649',
	weapon: 'Q728',
} as const;
export type Category = keyof typeof CATEGORIES;
