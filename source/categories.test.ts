import { ok } from "node:assert";
import { test } from "node:test";

import { CATEGORIES } from "./categories.ts";
import { getTopCategories } from "./queries.ts";

await test(
	"category has enough subcategories",
	{
		// Run multiple while not overwhelming Wikidata Servers
		concurrency: 4,
	},
	async (t) => {
		await Promise.all(
			Object.entries(CATEGORIES).map(([category, qNumber]) =>
				t.test(
					category,
					{
						// 70 seconds
						timeout: 1000 * 70,
					},
					async () => {
						const result = await getTopCategories(qNumber);
						console.log("category", category, result.length, result.join(" "));
						ok(result.length >= 5, `category ${category} has only ${result.length}`);
					},
				),
			),
		);
	},
);
