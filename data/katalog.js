/*
 * KATALOG – data oddělená od kódu.
 * Sem se později doplní ceny (Kč/m, Kč/ks, práce), limity zatížení apod.
 * Úpravy dělejte tady, ne v kódu aplikace.
 *
 * Profily jeklů (EN 10219, za studena tvarované):
 *   b = šířka [mm], h = výška [mm], t = tloušťka stěny [mm]
 *   vnější rádius rohu ro = 2·t, vnitřní ri = t (lze přepsat u profilu: ro, ri)
 */
(function (root) {
  root.KATALOG = {
    material: { nazev: "S235JR", hustota_kg_m3: 7850 },

    // Profily pro nohy
    profilyNohy: [
      { id: "40x40x2", b: 40, h: 40, t: 2 },
      { id: "50x50x2", b: 50, h: 50, t: 2 },
      { id: "50x50x3", b: 50, h: 50, t: 3 },
      { id: "60x60x3", b: 60, h: 60, t: 3 },
      { id: "80x80x3", b: 80, h: 80, t: 3 },
      { id: "80x40x3", b: 80, h: 40, t: 3 }
    ],

    // Profily pro rám pod deskou (luby) a spodní příčky.
    // b = vodorovný rozměr, h = svislý rozměr (jekl „na výšku“)
    profilyRamu: [
      { id: "40x20x2", b: 20, h: 40, t: 2 },
      { id: "40x40x2", b: 40, h: 40, t: 2 },
      { id: "50x30x2", b: 30, h: 50, t: 2 },
      { id: "60x30x2", b: 30, h: 60, t: 2 },
      { id: "60x40x3", b: 40, h: 60, t: 3 }
    ],

    // Patka pod nohou (výpalek na C2) – tloušťka a otvor pro matici M8
    patka: { t: 5, otvor: 9, zavit: "M8" },

    // Otvory v lubech pro přišroubování desky (výpal na K2)
    otvoryDeska: { horni: 5.5, spodni: 10, odKraje: 100, maxRozteč: 500 },

    // Povrchové úpravy (barva jen pro náhled)
    povrchy: [
      { id: "surovy", nazev: "Bez povrchové úpravy (surová ocel)", barva: "#8a8d91" },
      { id: "RAL9005", nazev: "Prášková barva RAL 9005 černá mat", barva: "#1c1c1e" },
      { id: "RAL7016", nazev: "Prášková barva RAL 7016 antracit", barva: "#383e42" },
      { id: "RAL9010", nazev: "Prášková barva RAL 9010 bílá", barva: "#f1ede1" },
      { id: "RAL7035", nazev: "Prášková barva RAL 7035 světle šedá", barva: "#cbd0cc" }
    ],

    // Rozsahy zadání
    limity: {
      deskaDelka: [600, 3000],
      deskaSirka: [400, 1200],
      vyskaStolu: [400, 1200],
      tloustkaDesky: [0, 80],
      presah: [0, 250],
      pocet: [1, 200]
    },

    // Nad touto délkou podnože se automaticky přidá střední příčka rámu
    stredniPricka_od: 1600,

    // Výchozí nastavení formuláře
    vychozi: {
      deskaDelka: 1600,
      deskaSirka: 800,
      vyskaStolu: 750,
      tloustkaDesky: 30,
      presah: 50,
      profilNohy: "60x60x3",
      profilRamu: "40x20x2",
      patky: true,
      spodniPricky: false,
      vyskaPricky: 150,
      otvoryDeska: true,
      povrch: "RAL9005",
      pocet: 1
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
