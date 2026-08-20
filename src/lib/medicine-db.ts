/**
 * Reference list of common generics and Indian brand names.
 *
 * Used to fuzzy-repair OCR slips in the one token that matters most — the drug name.
 * A wider list means fewer real medicines get flagged as low-confidence, so it is worth
 * extending whenever a legitimate drug shows up unmatched in review.
 */
export const medicineDatabase = [
    // --- Analgesics / antipyretics ---
    "Paracetamol",
    "Acetaminophen",
    "Ibuprofen",
    "Diclofenac",
    "Aceclofenac",
    "Naproxen",
    "Aspirin",
    "Tramadol",
    "Mefenamic Acid",
    "Nimesulide",
    "Dolo 650",
    "Crocin",
    "Combiflam",
    "Crosin",
    "Volini",
    "Zerodol",
    "Flexon",

    // --- Antibiotics ---
    "Amoxicillin",
    "Azithromycin",
    "Clavulanic Acid",
    "Augmentin",
    "Cefixime",
    "Cefuroxime",
    "Ceftriaxone",
    "Cephalexin",
    "Ciprofloxacin",
    "Levofloxacin",
    "Ofloxacin",
    "Doxycycline",
    "Metronidazole",
    "Ornidazole",
    "Clindamycin",
    "Norfloxacin",
    "Taxim",
    "Monocef",
    "Zifi",
    "Althrocin",

    // --- Gastro ---
    "Omeprazole",
    "Pantoprazole",
    "Rabeprazole",
    "Esomeprazole",
    "Ranitidine",
    "Famotidine",
    "Domperidone",
    "Ondansetron",
    "Sucralfate",
    "Dicyclomine",
    "Pan 40",
    "Rantac",
    "Gelusil",
    "Digene",
    "Zinetac",

    // --- Antihistamines / respiratory ---
    "Cetirizine",
    "Levocetirizine",
    "Fexofenadine",
    "Loratadine",
    "Montelukast",
    "Salbutamol",
    "Levosalbutamol",
    "Budesonide",
    "Ambroxol",
    "Guaifenesin",
    "Allegra",
    "Ascoril",
    "Asthalin",
    "Foracort",
    "Otrivin",

    // --- Cardiovascular ---
    "Amlodipine",
    "Telmisartan",
    "Losartan",
    "Olmesartan",
    "Ramipril",
    "Enalapril",
    "Metoprolol",
    "Atenolol",
    "Bisoprolol",
    "Atorvastatin",
    "Rosuvastatin",
    "Clopidogrel",
    "Furosemide",
    "Hydrochlorothiazide",
    "Telma",
    "Ecosprin",

    // --- Diabetes / thyroid ---
    "Metformin",
    "Glimepiride",
    "Gliclazide",
    "Sitagliptin",
    "Vildagliptin",
    "Teneligliptin",
    "Insulin",
    "Levothyroxine",
    "Thyronorm",
    "Glycomet",
    "Januvia",

    // --- Steroids / others ---
    "Prednisolone",
    "Dexamethasone",
    "Hydrocortisone",
    "Methylprednisolone",
    "Montair",

    // --- Supplements ---
    "Calcium Carbonate",
    "Cholecalciferol",
    "Vitamin D3",
    "Vitamin B12",
    "Methylcobalamin",
    "Folic Acid",
    "Ferrous Sulphate",
    "Ferrous Ascorbate",
    "Zinc Sulphate",
    "Shelcal",
    "Becosules",
    "Neurobion",
    "Cipcal",
    "Limcee",
    "Zincovit",
    "Autrin",

    // --- Neuro / psych ---
    "Gabapentin",
    "Pregabalin",
    "Amitriptyline",
    "Sertraline",
    "Escitalopram",
    "Alprazolam",
    "Clonazepam",
    "Levetiracetam",
    "Sodium Valproate",
]

export const commonFrequencies = [
    "OD",   // Once a day
    "BD",   // Twice a day (bis in die)
    "TDS",  // Thrice a day (ter die sumendum)
    "QID",  // Four times a day
    "HS",   // At bedtime (hora somni)
    "SOS",  // As needed (si opus sit)
    "STAT", // Immediately, single dose
    "PRN",  // As required
    "BBF",  // Before breakfast
    "ABF",  // After breakfast
    "BL",   // Before lunch
    "AL",   // After lunch
    "BD_",  // Before dinner
    "AD",   // After dinner
]
