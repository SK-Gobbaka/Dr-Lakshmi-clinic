// Extra detail for the starter treatments. Only used to fill the CMS the first time it is created;
// after that the admin edits treatments in the portal. General information, not medical advice:
// the doctor decides suitability and the number of sessions at the consultation.
export const TREATMENT_DETAILS: Record<string, { suitableFor: string; procedure: string; sessions: string; aftercare: string }> = {
  "hair-loss": {
    suitableFor: "Men and women with thinning, shedding or a receding hairline, including pattern hair loss and hair fall after illness, stress or childbirth.",
    procedure: "A scalp and hair examination, a check of your history and, where needed, blood tests to find the cause. The doctor then prescribes a plan that can combine medicines, mesotherapy and regenerative therapy.",
    sessions: "Reviews every 4 to 6 weeks; most plans run 3 to 6 months.",
    aftercare: "Take medicines as prescribed, use the advised shampoo, avoid harsh chemical treatments and keep review visits.",
  },
  "hair-transplant": {
    suitableFor: "Adults with stable, advanced hair loss and enough healthy donor hair at the back and sides of the scalp.",
    procedure: "Under local anaesthesia, healthy follicles are taken from the donor area (FUE or FUT) and placed one by one into thinning areas along a natural hairline design.",
    sessions: "Usually one day; larger areas may need a second session later.",
    aftercare: "Keep the scalp clean as instructed, avoid touching or scratching, sleep with your head raised for the first nights and avoid sun and strenuous exercise for the first weeks. New growth shows over several months.",
  },
  "prp-therapy": {
    suitableFor: "People with early hair thinning or weak hair, and for skin freshening under the doctor's advice.",
    procedure: "A small blood sample is taken, spun to concentrate the platelets, and the plasma is injected into the scalp or skin with fine needles.",
    sessions: "About 45 minutes per session; commonly 3 to 4 sessions a month apart, then top-ups.",
    aftercare: "Mild redness or tenderness settles in a day or two. Avoid washing the hair for the first few hours and avoid strenuous exercise on the day.",
  },
  acne: {
    suitableFor: "Teenagers and adults with active pimples, cysts, blackheads or acne scars.",
    procedure: "Skin assessment, then a plan that may include creams, oral medicines, chemical peels and laser, chosen for your skin type and the severity of the acne.",
    sessions: "Review every 2 to 4 weeks; most plans run 2 to 4 months.",
    aftercare: "Use the prescribed routine, a gentle cleanser and sunscreen, and do not pick or squeeze spots.",
  },
  pigmentation: {
    suitableFor: "People with melasma, sun spots, dark patches or uneven skin tone.",
    procedure: "The doctor identifies the type of pigmentation, then combines lightening creams, chemical peels, Q-switched laser and oral medicines as needed.",
    sessions: "Sessions every 2 to 4 weeks; improvement is gradual over 3 to 6 months.",
    aftercare: "Daily sunscreen and sun protection are essential. Follow the home routine to keep results.",
  },
  "laser-treatment": {
    suitableFor: "Adults wanting permanent hair reduction, skin resurfacing, scar or tattoo treatment, or treatment of small vascular lesions.",
    procedure: "A test patch is done first. Laser settings are matched to your skin and hair type, and each session takes about 30 to 60 minutes.",
    sessions: "Depends on the concern; the doctor will advise at your consultation.",
    aftercare: "Avoid sun exposure and use sunscreen, skip hot water and harsh products for a day or two, and do not pick at treated skin.",
  },
  "skin-rejuvenation": {
    suitableFor: "People with dull skin, fine lines, uneven texture or early signs of ageing.",
    procedure: "A tailored mix of microneedling, PRP facials, chemical peels and other anti-ageing treatments after a skin assessment.",
    sessions: "Typically 4 to 6 sessions, a few weeks apart.",
    aftercare: "Keep the skin moisturised, use sunscreen and avoid active products until the doctor allows.",
  },
  "laser-hair-removal": {
    suitableFor: "Adults who want long-term reduction of unwanted hair on the face or body, for most skin tones.",
    procedure: "The area is cleaned and shaved, cooling is applied and the laser is passed over the skin. Settings are matched to your skin and hair.",
    sessions: "Usually 6 to 8 sessions, 4 to 8 weeks apart.",
    aftercare: "Avoid sun, waxing and plucking between sessions, shave only, and use sunscreen on treated areas.",
  },
};
