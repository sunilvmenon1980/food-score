// Runs the scorer embedded in index.html against reference products.
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const src = html.match(/<script id="scorer">([\s\S]*?)<\/script>/)[1] + html.match(/<script id="parsers">([\s\S]*?)<\/script>/)[1];
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src + "\nObject.assign(this, {scoreProduct, parseNutrition, detectFlags, sugarSourceFrom, fromOFF});", ctx);

const P = (o) => ({ isDrink: false, sugarSource: "mixed", flags: {}, ...o });
const cases = [
  ["porridge oats", P({ kcal: 375, fat: 8, satFat: 1.5, carbs: 60, sugars: 1, fibre: 9, protein: 11, salt: 0.01, sugarSource: "none", flags: { wholegrainPulses: true } }), 8, 10],
  ["0% Greek yogurt", P({ kcal: 57, fat: 0.2, satFat: 0.1, carbs: 3.6, sugars: 3.6, fibre: 0, protein: 10, salt: 0.1, sugarSource: "milk" }), 8, 10],
  ["mature cheddar", P({ kcal: 416, fat: 34.9, satFat: 21.7, carbs: 0.1, sugars: 0.1, fibre: 0, protein: 25.4, salt: 1.8 }), 1, 3],
  ["coconut milk", P({ kcal: 169, fat: 17, satFat: 15, carbs: 2.5, sugars: 2, fibre: 0, protein: 1.4, salt: 0.05, flags: { hardFats: true } }), 1, 3],
  ["white bread", P({ kcal: 240, fat: 1.9, satFat: 0.4, carbs: 46, sugars: 3.4, fibre: 2.6, protein: 9, salt: 1.0, sugarSource: "added" }), 4, 6],
  ["wholemeal bread", P({ kcal: 230, fat: 2.5, satFat: 0.5, carbs: 38, sugars: 2.5, fibre: 7, protein: 10, salt: 1.0, flags: { wholegrainPulses: true } }), 7, 9],
  ["cola", P({ isDrink: true, kcal: 42, fat: 0, satFat: 0, carbs: 10.6, sugars: 10.6, fibre: 0, protein: 0, salt: 0, sugarSource: "added" }), 1, 2],
  ["diet cola", P({ isDrink: true, kcal: 0.4, fat: 0, satFat: 0, carbs: 0, sugars: 0, fibre: 0, protein: 0, salt: 0.02, sugarSource: "none", flags: { sweeteners: true } }), 6, 7],
  ["orange juice", P({ isDrink: true, kcal: 45, fat: 0, satFat: 0, carbs: 9, sugars: 9, fibre: 0.5, protein: 0.6, salt: 0, sugarSource: "juice" }), 1, 3],
  ["semi-skimmed milk", P({ isDrink: true, kcal: 47, fat: 1.7, satFat: 1.1, carbs: 4.8, sugars: 4.8, fibre: 0, protein: 3.5, salt: 0.1, sugarSource: "milk" }), 5, 8],
  ["salted crisps", P({ kcal: 530, fat: 32, satFat: 2.6, carbs: 50, sugars: 0.5, fibre: 4.5, protein: 6.5, salt: 1.4 }), 1, 3],
  ["energy drink", P({ isDrink: true, kcal: 46, fat: 0, satFat: 0, carbs: 11, sugars: 11, fibre: 0, protein: 0, salt: 0.1, sugarSource: "added", flags: { stimulant: true } }), 1, 2],
  ["LoSalt", P({ kcal: 0, fat: 0, satFat: 0, carbs: 0, sugars: 0, fibre: 0, protein: 0, salt: 33, flags: { saltSubstitute: true } }), 1, 1],
  ["unsalted mixed nuts", P({ kcal: 610, fat: 54, satFat: 6, carbs: 9, sugars: 4, fibre: 7, protein: 20, salt: 0.02, flags: { nutsSeedsOil: true } }), 6, 9],
  ["butter", P({ kcal: 740, fat: 82, satFat: 52, carbs: 0.6, sugars: 0.6, fibre: 0, protein: 0.6, salt: 1.5, flags: { hardFats: true } }), 1, 1],
  ["ready meal 400 g", P({ kcal: 110, fat: 3, satFat: 1.2, carbs: 14, sugars: 3, fibre: 1.5, protein: 6, salt: 0.75, portionG: 400 }), 3, 6],
  ["sugary cereal", P({ kcal: 380, fat: 2, satFat: 0.5, carbs: 84, sugars: 35, fibre: 2.5, protein: 7, salt: 0.7, sugarSource: "added" }), 1, 3],
  ["turmeric supplement", P({ isSupplement: true, flags: { bleedingHerbs: true } }), 1, 3],
  ["unreadable", P({}), null, null],
];

let fail = 0;
for (const [name, p, lo, hi] of cases) {
  const r = ctx.scoreProduct(p);
  const ok = lo === null ? r.score === null : r.score >= lo && r.score <= hi;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(22)} score ${String(r.score).padStart(4)}  raw ${String(r.raw).padStart(5)}  want ${lo}-${hi}${r.warnings.length ? "  [cap]" : ""}`);
}
// Label text as a phone OCR typically returns it
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`}`);
};
const ocr1 = `NUTRITION
Typical values Per 100g Per 40g serving
Energy 1569kJ / 375kcal 628kJ / 150kcal
Fat 8.0g 3.2g
of which saturates 1,5g 0.6g
Carbohydrate 60g 24g
of which sugars 1.0g 0.4g
Fibre 9.0g 3.6g
Protein 11g 4.4g
Salt <0.01g <0.01g`;
const p1 = ctx.parseNutrition(ocr1);
check("OCR oats table", [p1.kcal, p1.fat, p1.satFat, p1.carbs, p1.sugars, p1.fibre, p1.protein, p1.salt, p1.isDrink], [375, 8, 1.5, 60, 1, 9, 11, 0.01, false]);
const ocr2 = `Nutrition Information per 100ml
Energy 180kJ
Fat 0g
of which saturates 0g
Carbohydrate 10.6g
of which sugars 10.6g
Protein 0g
Sodium 0.01g`;
const p2 = ctx.parseNutrition(ocr2);
check("OCR drink, kJ and sodium only", [p2.kcal, p2.sugars, p2.salt, p2.isDrink], [43, 10.6, 0.03, true]);
// Real Tesseract output from the browser test, with "g" misread as "9"
const ocr3 = "NUTRITION\n\nTypical values Per 100g Per 30g\nEnergy 1729kJ/412kcal 519kJ/124kcal\nFat 2.0g 0.69\n\nof which saturates 0.5g 0.29\nCarbohydrate 84g 259\n\nof which sugars 35g 10.5¢g\n\nFibre 2.59 0.89\n\nProtein 7.0g 21g\n\nSalt 0.70g 0.21g\n";
const p3 = ctx.parseNutrition(ocr3);
check("OCR with g read as 9", [p3.kcal, p3.fat, p3.satFat, p3.carbs, p3.sugars, p3.fibre, p3.protein, p3.salt], [412, 2, 0.5, 84, 35, 2.5, 7, 0.7]);
const f1 = ctx.detectFlags("Water, Sugar, Potassium Chloride, Acid (Citric Acid), Caffeine, Taurine, Sweetener (Sucralose)");
check("flags: salt sub, stimulant, sweetener", [f1.saltSubstitute, f1.stimulant, f1.sweeteners, f1.hardFats], [true, true, true, false]);
const f2 = ctx.detectFlags("Peanuts (95%), Palm Oil, Salt. Peanut butter style");
check("flags: nuts first, palm oil, peanut butter not butter", [f2.nutsSeedsOil, f2.hardFats], [true, true]);
const f3 = ctx.detectFlags("Wholegrain Oat Flakes (100%)");
check("flags: wholegrain oats", [f3.wholegrainPulses, f3.hardFats, f3.alcohol], [true, false, false]);
const f4 = ctx.detectFlags("Potatoes, Sunflower Oil, Salt, Red Wine Vinegar Powder");
check("flags: wine vinegar is not alcohol", [f4.alcohol, f4.nutsSeedsOil], [false, false]);
check("sugar source", [ctx.sugarSourceFrom("Milk, Yogurt Cultures", 4), ctx.sugarSourceFrom("Oats, Sugar, Honey", 20), ctx.sugarSourceFrom("Orange juice from concentrate", 9)], ["milk", "added", "juice"]);
const off = ctx.fromOFF({ product_name: "Coca-Cola", brands: "Coca-Cola", quantity: "330 ml", categories_tags: ["en:beverages", "en:sodas"],
  ingredients_text_en: "Carbonated water, sugar, colour (caramel E150d), phosphoric acid, natural flavourings including caffeine",
  nutriments: { "energy-kcal_100g": 42, fat_100g: 0, "saturated-fat_100g": 0, carbohydrates_100g: 10.6, sugars_100g: 10.6, proteins_100g: 0, salt_100g: 0 } });
const offScore = ctx.scoreProduct(off).score;
check("Open Food Facts cola record", [off.isDrink, off.sugarSource, off.flags.stimulant, offScore], [true, "added", false, 2]);

console.log(fail ? `\n${fail} failing` : "\nall pass");
process.exit(fail ? 1 : 0);
