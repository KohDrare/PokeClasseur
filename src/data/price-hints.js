/* Prices found by hand while TCGdex has none yet (new extension).
   Règne Delta, 7 November 2026: Cardmarket prices listed by Pokescam, averaged with Pika-collect's for the hits
   (the market of a set released the day before moves a lot; both sources disagree, the average evens it out).
   They are only used while the card has no TCGdex price. */
export const PRICE_DATE = { me06: "2026-11-07" };
export const PRICE_HINT = {
  me06: {"001":0.02,"002":0.1,"003":0.02,"004":0.03,"005":0.08,"006":0.06,"007":0.1,"008":0.02,"009":0.02,"010":0.1,"011":0.64,"012":0.08,"013":0.05,"014":0.58,"015":0.02,"016":0.02,"017":0.03,"018":0.04,"019":0.1,"020":0.05,"021":1.8,"022":0.15,"023":0.51,"024":0.06,"025":0.02,"026":0.1,"027":0.07,"028":0.12,"029":0.54,"030":0.06,"031":0.05,"032":0.14,"033":0.47,"034":0.02,"035":0.12,"036":0.03,"037":0.02,"038":0.11,"039":0.02,"040":0.02,"041":0.09,"042":0.04,"043":0.02,"044":0.08,"045":0.18,"046":0.05,"047":0.92,"048":0.14,"049":0.02,"050":0.02,"051":0.03,"052":0.07,"053":0.07,"054":0.05,"055":0.05,"056":0.04,"057":0.06,"058":0.02,"059":0.07,"060":0.06,"061":0.05,"062":0.05,"063":0.05,"064":0.09,"065":0.02,"066":0.03,"067":0.98,"068":0.07,"069":1.09,"070":0.02,"071":0.04,"072":0.06,"073":0.05,"074":0.02,"075":0.02,"076":0.02,"077":0.02,"078":0.07,"079":0.02,"080":0.2,"081":0.11,"082":0.15,"083":0.02,"084":4.07,"085":0.14,"086":0.02,"087":0.15,"088":3.77,"089":0.17,"090":0.18,"091":0.11,"092":0.07,"093":0.04,"094":0.64,"095":0.63,"096":0.3,"097":0.3,"098":0.55,"099":0.56,"100":0.11,"101":0.19,"102":0.13,"103":0.16,"104":3.3,"105":12.04,"106":10.69,"107":7.07,"108":4.73,"109":4.35,"110":5.88,"111":22.16,"112":6.88,"113":3.06,"114":21.43,"115":5.87,"116":8.05,"117":14.88,"118":4.44,"119":3.92,"120":2.58,"121":3.06,"122":3.79,"123":5.85,"124":8.52,"125":4.78,"126":6.76,"127":2.59,"128":4.33,"129":4.3,"130":7.0,"131":5.46,"132":3.0,"133":2.9,"134":2.25,"135":27.0,"136":99.37,"137":34.0,"138":431.72,"139":18.29,"140":39.88,"141":280.0}
};
export const priceHint = (setId, n) => PRICE_HINT[setId]?.[String(n).padStart(3, "0")] || 0;

/* TCGdex sometimes links a card of a brand-new extension to the wrong Cardmarket product (Règne Delta's
   Raikou-ex illustration spéciale got the plain Raikou-ex: 0,65 € instead of about 100 €). Its Cardmarket
   price is kept unless it is far below what the hand price or TCGplayer say; then that price is used instead. */
export const USD_EUR = 0.86;
export function tcgplayerEur(tp) {
  if (!tp) return 0;
  const vals = Object.entries(tp).filter(([k, x]) => x && typeof x === "object" && !/reverse|1st/i.test(k)).map(([, x]) => x.marketPrice || x.midPrice || 0);
  return vals.length ? Math.max(...vals) * USD_EUR : 0;
}
/* returns null when the Cardmarket price looks right, otherwise { p, src: "hint" | "tcgplayer" } */
export function priceCheck(setId, n, cmPrice, tp) {
  const hint = priceHint(setId, n), us = tcgplayerEur(tp), ref = hint || us;
  if (!cmPrice || ref < 3 || cmPrice >= ref * 0.3) return null;
  return { p: Math.round(ref * 100) / 100, src: hint ? "hint" : "tcgplayer" };
}
