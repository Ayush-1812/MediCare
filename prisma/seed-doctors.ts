/**
 * Seeds 50 demo doctors.
 * ──────────────────────
 *   npx tsx prisma/seed-doctors.ts              # dry run — prints the plan, writes nothing
 *   npx tsx prisma/seed-doctors.ts --commit     # writes to the database in DATABASE_URL
 *   npx tsx prisma/seed-doctors.ts --remove     # deletes only these seeded doctors
 *
 * **Dry run is the default on purpose.** The configured DATABASE_URL points at a hosted
 * Supabase instance, not localhost, so a script that writes the moment you run it is the
 * wrong shape. You have to say `--commit`.
 *
 * Design notes:
 *
 * · **Idempotent.** Every doctor is upserted by email, so running it twice updates the
 *   same 50 rows rather than creating 100. Safe to re-run after editing the data.
 *
 * · **Identifiable and reversible.** Every seeded email ends in `@${SEED_DOMAIN}`, which
 *   is both how `--remove` finds them and how you can tell demo data from a real
 *   registration at a glance. `.invalid` is reserved by RFC 2606 and can never receive
 *   mail — which matters here, because booking an appointment emails the doctor, and
 *   seeding 50 addresses that might belong to real people would send them real mail.
 *
 * · **Existing rows are never touched.** The 13 doctors already in the database are left
 *   exactly as they are.
 *
 * · **Specialities.** `/doctors/[speciality]` filters on the six strings in
 *   `src/lib/constants.ts` — and on their exact spelling, including "Pediatricians"
 *   plural and "General physician" with a lowercase p. Those six are populated so every
 *   category tile leads somewhere; the rest add variety and are reachable through search
 *   and the full directory, just not through a tile.
 *
 * · **Avatars.** Illustrated, generated deterministically from each name, and saved as
 *   local files under `public/doctors/`. Not photographs: attaching a real person's face
 *   to a fictional doctor in a live application is not something to seed, and licensed
 *   stock would still be a real face. `Doctor.image` holds a plain path, so swapping in
 *   real photography later is a one-field change per row.
 */

import fs from 'node:fs'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import { PrismaClient, type Prisma } from '@prisma/client'

for (const file of ['.env.local', '.env']) {
    const full = path.join(process.cwd(), file)
    if (!fs.existsSync(full)) continue
    for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
        const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
        if (!match || process.env[match[1]]) continue
        process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
    }
}

const SEED_DOMAIN = 'demo-medicare.invalid'
const DEMO_PASSWORD = 'Doctor@12345'
const AVATAR_DIR = path.join(process.cwd(), 'public', 'doctors')

/** The six the UI can browse by. Spelling matters — it is matched exactly. */
const BROWSABLE = [
    'General physician',
    'Gynecologist',
    'Dermatologist',
    'Pediatricians',
    'Neurologist',
    'Gastroenterologist',
] as const

type Seed = {
    name: string
    gender: 'Male' | 'Female'
    speciality: string
    degree: string
    experience: string
    city: string
    hospital: string
    fees: number
    languages: string
    about: string
}

/**
 * Names span North, South, East and West India rather than defaulting to one region, and
 * genders are mixed roughly evenly — a directory of fifty same-region male doctors would
 * be a strange thing for a demo to assert about Indian medicine.
 */
const DOCTORS: Seed[] = [
    // ── General physician (7) ────────────────────────────────────────────
    { name: 'Dr. Aarav Sharma', gender: 'Male', speciality: 'General physician', degree: 'MBBS, MD (Internal Medicine)', experience: '12 Years', city: 'New Delhi', hospital: 'Apollo Hospital', fees: 600, languages: 'English, Hindi', about: 'Treats everyday illness and long-term conditions, with an interest in preventive care and early diagnosis.' },
    { name: 'Dr. Meera Iyer', gender: 'Female', speciality: 'General physician', degree: 'MBBS, DNB (Family Medicine)', experience: '9 Years', city: 'Chennai', hospital: 'Kauvery Hospital', fees: 450, languages: 'English, Tamil, Hindi', about: 'Family physician focused on continuity of care for whole households, including elderly patients.' },
    { name: 'Dr. Rajat Deshmukh', gender: 'Male', speciality: 'General physician', degree: 'MBBS, MD', experience: '15 Years', city: 'Pune', hospital: 'Ruby Hall Clinic', fees: 550, languages: 'English, Marathi, Hindi', about: 'General medicine with a focus on diabetes and hypertension management.' },
    { name: 'Dr. Sneha Pillai', gender: 'Female', speciality: 'General physician', degree: 'MBBS, MD (General Medicine)', experience: '7 Years', city: 'Kochi', hospital: 'Amrita Institute', fees: 400, languages: 'English, Malayalam, Hindi', about: 'Internal medicine, with particular attention to thyroid and metabolic conditions.' },
    { name: 'Dr. Imran Qureshi', gender: 'Male', speciality: 'General physician', degree: 'MBBS, MD', experience: '11 Years', city: 'Hyderabad', hospital: 'Yashoda Hospital', fees: 500, languages: 'English, Hindi, Urdu, Telugu', about: 'Sees a broad general caseload and coordinates referrals to specialists where needed.' },
    { name: 'Dr. Ananya Bose', gender: 'Female', speciality: 'General physician', degree: 'MBBS, DNB', experience: '6 Years', city: 'Kolkata', hospital: 'AMRI Hospital', fees: 380, languages: 'English, Bengali, Hindi', about: 'General practice with an interest in infectious disease and travel medicine.' },
    { name: 'Dr. Harpreet Singh', gender: 'Male', speciality: 'General physician', degree: 'MBBS, MD (Medicine)', experience: '18 Years', city: 'Chandigarh', hospital: 'Fortis Hospital', fees: 650, languages: 'English, Punjabi, Hindi', about: 'Senior physician with long experience in acute and chronic adult medicine.' },

    // ── Gynecologist (7) ─────────────────────────────────────────────────
    { name: 'Dr. Priya Mehta', gender: 'Female', speciality: 'Gynecologist', degree: 'MBBS, MS (Obstetrics & Gynaecology)', experience: '14 Years', city: 'Mumbai', hospital: 'Lilavati Hospital', fees: 900, languages: 'English, Hindi, Gujarati', about: 'Obstetrics and gynaecology, including high-risk pregnancy care.' },
    { name: 'Dr. Lakshmi Reddy', gender: 'Female', speciality: 'Gynecologist', degree: 'MBBS, DGO, DNB', experience: '10 Years', city: 'Hyderabad', hospital: 'Rainbow Hospital', fees: 750, languages: 'English, Telugu, Hindi', about: 'Women\'s health across all ages, with a focus on fertility and menstrual disorders.' },
    { name: 'Dr. Kavita Joshi', gender: 'Female', speciality: 'Gynecologist', degree: 'MBBS, MD (Obs & Gyn)', experience: '16 Years', city: 'Pune', hospital: 'Jehangir Hospital', fees: 800, languages: 'English, Marathi, Hindi', about: 'Laparoscopic gynaecological surgery and routine antenatal care.' },
    { name: 'Dr. Farida Shaikh', gender: 'Female', speciality: 'Gynecologist', degree: 'MBBS, MS', experience: '8 Years', city: 'Ahmedabad', hospital: 'Sterling Hospital', fees: 600, languages: 'English, Gujarati, Hindi, Urdu', about: 'Antenatal care, contraception counselling and adolescent gynaecology.' },
    { name: 'Dr. Ritu Agarwal', gender: 'Female', speciality: 'Gynecologist', degree: 'MBBS, DNB (Obs & Gyn)', experience: '12 Years', city: 'Jaipur', hospital: 'Narayana Hospital', fees: 700, languages: 'English, Hindi', about: 'Obstetrics with a special interest in postnatal and maternal mental health.' },
    { name: 'Dr. Shalini Nair', gender: 'Female', speciality: 'Gynecologist', degree: 'MBBS, MS, FMAS', experience: '11 Years', city: 'Bengaluru', hospital: 'Manipal Hospital', fees: 850, languages: 'English, Malayalam, Kannada, Hindi', about: 'Minimally invasive gynaecological surgery and endometriosis care.' },
    { name: 'Dr. Devika Chatterjee', gender: 'Female', speciality: 'Gynecologist', degree: 'MBBS, DGO', experience: '9 Years', city: 'Kolkata', hospital: 'Apollo Gleneagles', fees: 650, languages: 'English, Bengali, Hindi', about: 'General gynaecology and routine screening, including cervical cancer screening.' },

    // ── Dermatologist (7) ────────────────────────────────────────────────
    { name: 'Dr. Aditi Sharma', gender: 'Female', speciality: 'Dermatologist', degree: 'MBBS, MD (Dermatology)', experience: '8 Years', city: 'New Delhi', hospital: 'Max Healthcare', fees: 700, languages: 'English, Hindi', about: 'Medical dermatology, acne and pigmentation, with a focus on Indian skin types.' },
    { name: 'Dr. Vikram Malhotra', gender: 'Male', speciality: 'Dermatologist', degree: 'MBBS, DVD, MD', experience: '13 Years', city: 'Mumbai', hospital: 'Kokilaben Hospital', fees: 950, languages: 'English, Hindi, Marathi', about: 'Treats chronic skin conditions including psoriasis and eczema.' },
    { name: 'Dr. Swati Kulkarni', gender: 'Female', speciality: 'Dermatologist', degree: 'MBBS, MD (Skin & VD)', experience: '6 Years', city: 'Pune', hospital: 'Deenanath Mangeshkar Hospital', fees: 550, languages: 'English, Marathi, Hindi', about: 'General dermatology, hair loss and paediatric skin conditions.' },
    { name: 'Dr. Arjun Menon', gender: 'Male', speciality: 'Dermatologist', degree: 'MBBS, MD, DNB', experience: '10 Years', city: 'Kochi', hospital: 'Lisie Hospital', fees: 600, languages: 'English, Malayalam, Hindi', about: 'Dermatology and dermatosurgery, including vitiligo management.' },
    { name: 'Dr. Nisha Verma', gender: 'Female', speciality: 'Dermatologist', degree: 'MBBS, MD', experience: '7 Years', city: 'Lucknow', hospital: 'Medanta Hospital', fees: 500, languages: 'English, Hindi', about: 'Clinical dermatology with an interest in allergic and autoimmune skin disease.' },
    { name: 'Dr. Rohan Kapoor', gender: 'Male', speciality: 'Dermatologist', degree: 'MBBS, DDVL', experience: '9 Years', city: 'Chandigarh', hospital: 'PGI Associated Clinic', fees: 650, languages: 'English, Punjabi, Hindi', about: 'Acne, scarring and procedural dermatology.' },
    { name: 'Dr. Tanvi Shah', gender: 'Female', speciality: 'Dermatologist', degree: 'MBBS, MD (Dermatology)', experience: '5 Years', city: 'Ahmedabad', hospital: 'Zydus Hospital', fees: 450, languages: 'English, Gujarati, Hindi', about: 'General skin, hair and nail conditions for adults and children.' },

    // ── Pediatricians (7) ────────────────────────────────────────────────
    { name: 'Dr. Sanjay Gupta', gender: 'Male', speciality: 'Pediatricians', degree: 'MBBS, MD (Paediatrics)', experience: '17 Years', city: 'New Delhi', hospital: 'Sir Ganga Ram Hospital', fees: 700, languages: 'English, Hindi', about: 'General paediatrics, childhood immunisation and growth monitoring.' },
    { name: 'Dr. Divya Raman', gender: 'Female', speciality: 'Pediatricians', degree: 'MBBS, DCH, DNB', experience: '11 Years', city: 'Chennai', hospital: 'Apollo Children\'s Hospital', fees: 600, languages: 'English, Tamil, Hindi', about: 'Newborn and infant care, including feeding and development concerns.' },
    { name: 'Dr. Mohit Bhandari', gender: 'Male', speciality: 'Pediatricians', degree: 'MBBS, MD', experience: '8 Years', city: 'Jaipur', hospital: 'Fortis Escorts', fees: 500, languages: 'English, Hindi, Rajasthani', about: 'Paediatric respiratory illness and childhood asthma.' },
    { name: 'Dr. Reshma Fernandes', gender: 'Female', speciality: 'Pediatricians', degree: 'MBBS, DCH', experience: '13 Years', city: 'Goa', hospital: 'Manipal Hospital Goa', fees: 550, languages: 'English, Konkani, Hindi, Marathi', about: 'General paediatrics with a focus on adolescent health.' },
    { name: 'Dr. Prakash Rao', gender: 'Male', speciality: 'Pediatricians', degree: 'MBBS, MD (Paediatrics)', experience: '20 Years', city: 'Bengaluru', hospital: 'Rainbow Children\'s Hospital', fees: 800, languages: 'English, Kannada, Telugu, Hindi', about: 'Senior paediatrician with experience in neonatal intensive care.' },
    { name: 'Dr. Ayesha Khan', gender: 'Female', speciality: 'Pediatricians', degree: 'MBBS, DNB (Paediatrics)', experience: '6 Years', city: 'Hyderabad', hospital: 'Continental Hospital', fees: 450, languages: 'English, Hindi, Urdu, Telugu', about: 'Routine childhood illness, nutrition and vaccination schedules.' },
    { name: 'Dr. Subhasis Dutta', gender: 'Male', speciality: 'Pediatricians', degree: 'MBBS, MD', experience: '14 Years', city: 'Kolkata', hospital: 'Institute of Child Health', fees: 600, languages: 'English, Bengali, Hindi', about: 'Paediatric gastroenterology and nutrition alongside general practice.' },

    // ── Neurologist (6) ──────────────────────────────────────────────────
    { name: 'Dr. Ramesh Subramanian', gender: 'Male', speciality: 'Neurologist', degree: 'MBBS, MD, DM (Neurology)', experience: '19 Years', city: 'Chennai', hospital: 'MIOT International', fees: 1200, languages: 'English, Tamil, Hindi', about: 'Stroke medicine and epilepsy, with a movement disorders clinic.' },
    { name: 'Dr. Neha Trivedi', gender: 'Female', speciality: 'Neurologist', degree: 'MBBS, MD, DNB (Neurology)', experience: '10 Years', city: 'Mumbai', hospital: 'Hinduja Hospital', fees: 1100, languages: 'English, Hindi, Gujarati', about: 'Headache and migraine management, and multiple sclerosis care.' },
    { name: 'Dr. Abhishek Sinha', gender: 'Male', speciality: 'Neurologist', degree: 'MBBS, DM (Neurology)', experience: '12 Years', city: 'New Delhi', hospital: 'AIIMS Associated Clinic', fees: 1000, languages: 'English, Hindi', about: 'Epilepsy, neuromuscular disease and nerve conduction studies.' },
    { name: 'Dr. Suchitra Hegde', gender: 'Female', speciality: 'Neurologist', degree: 'MBBS, MD, DM', experience: '9 Years', city: 'Bengaluru', hospital: 'NIMHANS Associated Clinic', fees: 950, languages: 'English, Kannada, Hindi', about: 'Cognitive neurology and memory disorders.' },
    { name: 'Dr. Jatin Chawla', gender: 'Male', speciality: 'Neurologist', degree: 'MBBS, MD (Neurology)', experience: '15 Years', city: 'Chandigarh', hospital: 'Max Super Speciality', fees: 1050, languages: 'English, Punjabi, Hindi', about: 'Parkinson\'s disease and other movement disorders.' },
    { name: 'Dr. Ipsita Mohanty', gender: 'Female', speciality: 'Neurologist', degree: 'MBBS, DM', experience: '7 Years', city: 'Bhubaneswar', hospital: 'AIIMS Bhubaneswar Clinic', fees: 800, languages: 'English, Odia, Hindi', about: 'General neurology with an interest in stroke rehabilitation.' },

    // ── Gastroenterologist (6) ───────────────────────────────────────────
    { name: 'Dr. Kiran Desai', gender: 'Male', speciality: 'Gastroenterologist', degree: 'MBBS, MD, DM (Gastroenterology)', experience: '16 Years', city: 'Mumbai', hospital: 'Jaslok Hospital', fees: 1200, languages: 'English, Hindi, Gujarati, Marathi', about: 'Liver disease and therapeutic endoscopy.' },
    { name: 'Dr. Anil Prasad', gender: 'Male', speciality: 'Gastroenterologist', degree: 'MBBS, MD, DNB', experience: '11 Years', city: 'Patna', hospital: 'Paras HMRI Hospital', fees: 750, languages: 'English, Hindi, Bhojpuri', about: 'Inflammatory bowel disease and chronic acidity.' },
    { name: 'Dr. Vandana Rathore', gender: 'Female', speciality: 'Gastroenterologist', degree: 'MBBS, DM', experience: '9 Years', city: 'New Delhi', hospital: 'BLK Hospital', fees: 1000, languages: 'English, Hindi', about: 'Functional gut disorders, including IBS, and nutritional care.' },
    { name: 'Dr. Suresh Kamath', gender: 'Male', speciality: 'Gastroenterologist', degree: 'MBBS, MD, DM', experience: '18 Years', city: 'Bengaluru', hospital: 'Sakra World Hospital', fees: 1150, languages: 'English, Kannada, Konkani, Hindi', about: 'Pancreatic and biliary disease, and advanced endoscopy.' },
    { name: 'Dr. Pooja Saxena', gender: 'Female', speciality: 'Gastroenterologist', degree: 'MBBS, MD (Medicine), DNB', experience: '7 Years', city: 'Lucknow', hospital: 'SGPGI Associated Clinic', fees: 650, languages: 'English, Hindi', about: 'General gastroenterology and hepatitis management.' },
    { name: 'Dr. Thomas Varghese', gender: 'Male', speciality: 'Gastroenterologist', degree: 'MBBS, DM (Gastro)', experience: '13 Years', city: 'Thiruvananthapuram', hospital: 'KIMS Hospital', fees: 900, languages: 'English, Malayalam, Hindi', about: 'Liver transplant follow-up and chronic liver disease.' },

    // ── Beyond the browsable six: reachable via search and the directory ──
    { name: 'Dr. Vivek Chandran', gender: 'Male', speciality: 'Cardiologist', degree: 'MBBS, MD, DM (Cardiology)', experience: '21 Years', city: 'Chennai', hospital: 'Madras Medical Mission', fees: 1400, languages: 'English, Tamil, Hindi', about: 'Interventional cardiology and heart failure care.' },
    { name: 'Dr. Mahesh Patil', gender: 'Male', speciality: 'Orthopedic', degree: 'MBBS, MS (Orthopaedics)', experience: '15 Years', city: 'Pune', hospital: 'Sancheti Hospital', fees: 800, languages: 'English, Marathi, Hindi', about: 'Joint replacement and sports injuries.' },
    { name: 'Dr. Nandita Ghosh', gender: 'Female', speciality: 'Psychiatrist', degree: 'MBBS, MD (Psychiatry)', experience: '11 Years', city: 'Kolkata', hospital: 'Fortis Anandapur', fees: 900, languages: 'English, Bengali, Hindi', about: 'Anxiety and mood disorders, with an interest in perinatal mental health.' },
    { name: 'Dr. Rakesh Yadav', gender: 'Male', speciality: 'ENT Specialist', degree: 'MBBS, MS (ENT)', experience: '14 Years', city: 'Kanpur', hospital: 'Regency Hospital', fees: 550, languages: 'English, Hindi', about: 'Ear, nose and throat surgery, including sinus and hearing problems.' },
    { name: 'Dr. Deepa Krishnan', gender: 'Female', speciality: 'Ophthalmologist', degree: 'MBBS, MS (Ophthalmology)', experience: '10 Years', city: 'Coimbatore', hospital: 'Aravind Eye Hospital', fees: 500, languages: 'English, Tamil, Hindi', about: 'Cataract surgery and diabetic retinopathy screening.' },
    { name: 'Dr. Sameer Ahluwalia', gender: 'Male', speciality: 'Endocrinologist', degree: 'MBBS, MD, DM (Endocrinology)', experience: '13 Years', city: 'New Delhi', hospital: 'Indraprastha Apollo', fees: 1100, languages: 'English, Hindi, Punjabi', about: 'Diabetes, thyroid and hormonal disorders.' },
    { name: 'Dr. Nitin Bhatt', gender: 'Male', speciality: 'Urologist', degree: 'MBBS, MS, MCh (Urology)', experience: '16 Years', city: 'Ahmedabad', hospital: 'Apollo Hospital Ahmedabad', fees: 950, languages: 'English, Gujarati, Hindi', about: 'Kidney stones, prostate disease and minimally invasive urology.' },
    { name: 'Dr. Leela Venkatesh', gender: 'Female', speciality: 'Pulmonologist', degree: 'MBBS, MD (Pulmonary Medicine)', experience: '9 Years', city: 'Hyderabad', hospital: 'KIMS Hospital Hyderabad', fees: 850, languages: 'English, Telugu, Hindi', about: 'Asthma, COPD and sleep-related breathing disorders.' },
    { name: 'Dr. Ashok Jadhav', gender: 'Male', speciality: 'Oncologist', degree: 'MBBS, MD, DM (Medical Oncology)', experience: '17 Years', city: 'Nagpur', hospital: 'Tata Memorial Associated Centre', fees: 1250, languages: 'English, Marathi, Hindi', about: 'Medical oncology with a focus on breast and gastrointestinal cancers.' },
    { name: 'Dr. Ruchi Saini', gender: 'Female', speciality: 'Nephrologist', degree: 'MBBS, MD, DM (Nephrology)', experience: '11 Years', city: 'Gurugram', hospital: 'Medanta The Medicity', fees: 1100, languages: 'English, Hindi', about: 'Chronic kidney disease, dialysis and transplant follow-up.' },
]

/** `Dr. Aarav Sharma` → `aarav-sharma` */
function slugFor(name: string): string {
    return name
        .replace(/^Dr\.?\s*/i, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
}

function emailFor(name: string): string {
    return `${slugFor(name)}@${SEED_DOMAIN}`
}

/**
 * Consulting hours, varied deterministically so the booking calendar is not fifty
 * identical 10-to-5 schedules — which would make every slot list look the same and hide
 * exactly the bugs a demo should surface.
 */
function scheduleFor(index: number) {
    const patterns = [
        { availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], slotStartTime: '10:00', slotEndTime: '17:00', slotDuration: 30 },
        { availableDays: ['Mon', 'Wed', 'Fri'], slotStartTime: '09:00', slotEndTime: '13:00', slotDuration: 20 },
        { availableDays: ['Tue', 'Thu', 'Sat'], slotStartTime: '16:00', slotEndTime: '20:00', slotDuration: 15 },
        { availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], slotStartTime: '11:00', slotEndTime: '19:00', slotDuration: 30 },
        { availableDays: ['Mon', 'Tue', 'Thu', 'Fri'], slotStartTime: '08:00', slotEndTime: '12:00', slotDuration: 20 },
    ]
    return patterns[index % patterns.length]
}

/**
 * Avatar palette and hair options, chosen to read as South Asian rather than taking the
 * generator's pale defaults.
 *
 * The `top` values are the ones this API version actually accepts. The first attempt used
 * names from an older release (`shortHairShortFlat`, `longHairStraight`) and every single
 * request came back HTTP 400 — which the script then swallowed into an empty image, so all
 * fifty doctors were seeded with no picture and nothing looked broken until the directory
 * was checked. Valid values come from `/9.x/avataaars/schema.json`.
 */
function avatarUrl(name: string, gender: 'Male' | 'Female'): string {
    const params = new URLSearchParams({
        seed: name,
        skinColor: 'ae5d29,d08b5b,edb98a',
        hairColor: '2c1b18,4a312c,724133',
        backgroundColor: 'e8eaff,dff3e8,fdf0e3,f3e8ff',
        top:
            gender === 'Female'
                ? 'longButNotTooLong,straight01,straight02,bob,bun,curly,bigHair'
                : 'shortFlat,shortRound,shortWaved,shortCurly,theCaesar,sides',
    })
    return `https://api.dicebear.com/9.x/avataaars/svg?${params.toString()}`
}

/**
 * Downloads each avatar once and writes it under `public/doctors/`.
 *
 * Saved locally rather than referenced by URL so the directory does not depend on a
 * third-party service staying up — `avatarFor` only falls back when `image` is empty, not
 * when a remote image fails to load, so a dead URL would render fifty broken images.
 */
async function fetchAvatars(commit: boolean): Promise<Map<string, string>> {
    const paths = new Map<string, string>()
    if (!commit) {
        for (const doctor of DOCTORS) paths.set(doctor.name, `/doctors/${slugFor(doctor.name)}.svg`)
        return paths
    }

    fs.mkdirSync(AVATAR_DIR, { recursive: true })
    let downloaded = 0
    let reused = 0
    const failures: string[] = []

    for (const doctor of DOCTORS) {
        const slug = slugFor(doctor.name)
        const file = path.join(AVATAR_DIR, `${slug}.svg`)
        const publicPath = `/doctors/${slug}.svg`
        paths.set(doctor.name, publicPath)

        if (fs.existsSync(file) && fs.statSync(file).size > 500) {
            reused += 1
            continue
        }

        try {
            const response = await fetch(avatarUrl(doctor.name, doctor.gender))
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            const svg = await response.text()
            if (!svg.includes('<svg')) throw new Error('not an SVG')
            fs.writeFileSync(file, svg, 'utf8')
            downloaded += 1
        } catch (error) {
            // One missing avatar is survivable: an empty `image` makes `avatarFor` fall
            // back to the gender avatar the app already ships, which is a reasonable
            // doctor card. What is NOT survivable is every avatar failing and the seed
            // still reporting success — that is exactly what happened on the first run,
            // and fifty doctors went in with no picture while the output looked fine.
            failures.push(`${doctor.name}: ${(error as Error).message}`)
            paths.set(doctor.name, '')
        }
    }

    console.log(`  avatars: ${downloaded} downloaded, ${reused} already present, ${failures.length} failed`)

    if (failures.length > 0) {
        console.warn(`\n  ! ${failures.length} avatar(s) failed:`)
        for (const line of failures.slice(0, 5)) console.warn(`      ${line}`)
        if (failures.length > 5) console.warn(`      … and ${failures.length - 5} more`)
    }

    // A wholesale failure means the generator's API changed or the network is blocked,
    // not that fifty doctors happen to be camera-shy. Refuse rather than quietly seeding
    // a directory of blank faces.
    if (failures.length > DOCTORS.length / 2) {
        throw new Error(
            `${failures.length} of ${DOCTORS.length} avatars failed — refusing to seed. ` +
                'Check the avatar API parameters against /9.x/avataaars/schema.json.',
        )
    }

    return paths
}

async function main() {
    const commit = process.argv.includes('--commit')
    const remove = process.argv.includes('--remove')

    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL is not set.')
        process.exit(1)
    }

    let host = 'unknown'
    try {
        host = new URL(process.env.DATABASE_URL).hostname
    } catch {
        /* leave as unknown */
    }

    console.log(`\nMediCare doctor seed`)
    console.log(`  database host: ${host}`)
    console.log(`  seed domain:   @${SEED_DOMAIN}`)
    console.log(`  doctors:       ${DOCTORS.length}`)
    console.log(`  mode:          ${remove ? 'REMOVE' : commit ? 'COMMIT (writes)' : 'DRY RUN (writes nothing)'}\n`)

    const prisma = new PrismaClient()

    try {
        if (remove) {
            const existing = await prisma.doctor.findMany({
                where: { email: { endsWith: `@${SEED_DOMAIN}` } },
                select: { id: true, name: true },
            })
            console.log(`  found ${existing.length} seeded doctors`)

            // Appointments reference Doctor, so a doctor with bookings cannot simply be
            // deleted. Reported rather than cascaded: silently removing a doctor who has
            // appointments would orphan someone's booking.
            const withAppointments = await prisma.appointment.groupBy({
                by: ['docId'],
                where: { docId: { in: existing.map((d) => d.id) } },
                _count: { _all: true },
            })
            if (withAppointments.length > 0) {
                console.log(`  ! ${withAppointments.length} of them have appointments and will NOT be deleted:`)
                for (const row of withAppointments) {
                    const doctor = existing.find((d) => d.id === row.docId)
                    console.log(`      ${doctor?.name ?? row.docId} — ${row._count._all} appointment(s)`)
                }
            }
            const deletable = existing
                .filter((d) => !withAppointments.some((w) => w.docId === d.id))
                .map((d) => d.id)

            if (!commit) {
                console.log(`\n  DRY RUN — would delete ${deletable.length}. Re-run with --remove --commit.\n`)
                return
            }
            const deleted = await prisma.doctor.deleteMany({ where: { id: { in: deletable } } })
            console.log(`\n  deleted ${deleted.count} seeded doctors\n`)
            return
        }

        const before = await prisma.doctor.count()
        const avatars = await fetchAvatars(commit)
        const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)

        const byCity = new Map<string, number>()
        const bySpeciality = new Map<string, number>()
        for (const doctor of DOCTORS) {
            byCity.set(doctor.city, (byCity.get(doctor.city) ?? 0) + 1)
            bySpeciality.set(doctor.speciality, (bySpeciality.get(doctor.speciality) ?? 0) + 1)
        }

        console.log(`  specialities (${bySpeciality.size}):`)
        for (const [speciality, count] of [...bySpeciality].sort((a, b) => b[1] - a[1])) {
            const tile = (BROWSABLE as readonly string[]).includes(speciality) ? ' [browsable tile]' : ''
            console.log(`    ${String(count).padStart(2)} × ${speciality}${tile}`)
        }
        console.log(`  cities: ${byCity.size}`)
        console.log(`  fees:   ₹${Math.min(...DOCTORS.map((d) => d.fees))} – ₹${Math.max(...DOCTORS.map((d) => d.fees))}`)
        console.log(`  doctors already in the database: ${before} (left untouched)\n`)

        if (!commit) {
            console.log('  DRY RUN — nothing was written. Sample of what would be upserted:\n')
            for (const doctor of DOCTORS.slice(0, 3)) {
                console.log(`    ${doctor.name}  <${emailFor(doctor.name)}>`)
                console.log(`      ${doctor.speciality} · ${doctor.city} · ₹${doctor.fees} · ${doctor.languages}`)
            }
            console.log(`\n  Re-run with --commit to write ${DOCTORS.length} doctors.\n`)
            return
        }

        let created = 0
        let updated = 0

        for (const [index, doctor] of DOCTORS.entries()) {
            const email = emailFor(doctor.name)
            const schedule = scheduleFor(index)
            const existing = await prisma.doctor.findUnique({ where: { email }, select: { id: true } })

            const data = {
                name: doctor.name,
                image: avatars.get(doctor.name) ?? '',
                speciality: doctor.speciality,
                degree: doctor.degree,
                experience: doctor.experience,
                about: doctor.about,
                languages: doctor.languages,
                fees: doctor.fees,
                gender: doctor.gender,
                city: doctor.city,
                hospital: doctor.hospital,
                // Deterministic from the index so the directory has a believable spread
                // rather than every doctor sitting at a suspicious 4.9.
                rating: Math.round((4.1 + ((index * 7) % 9) / 10) * 10) / 10,
                totalReviews: 40 + ((index * 37) % 260),
                registrationNo: `MCI-${2005 + (index % 18)}-${10000 + index * 137}`,
                address: { line1: doctor.hospital, line2: doctor.city } as Prisma.InputJsonObject,
                consultationModes: ['Video Consultation'] as Prisma.InputJsonValue,
                availableDays: schedule.availableDays as Prisma.InputJsonValue,
                slotStartTime: schedule.slotStartTime,
                slotEndTime: schedule.slotEndTime,
                slotDuration: schedule.slotDuration,
                available: true,
                // Without this they are filtered out of `doctorList` and are not bookable.
                profileCompleted: true,
            }

            await prisma.doctor.upsert({
                where: { email },
                // `slots_booked` is deliberately absent from the update branch: re-running
                // the seed must not wipe bookings someone has already made.
                update: data,
                create: { ...data, email, password: passwordHash },
            })

            if (existing) updated += 1
            else created += 1
        }

        const after = await prisma.doctor.count()
        console.log(`  created: ${created}`)
        console.log(`  updated: ${updated}`)
        console.log(`  doctors in database: ${before} → ${after}\n`)
        console.log(`  Doctor login: <slug>@${SEED_DOMAIN} / ${DEMO_PASSWORD}`)
        console.log(`  e.g. ${emailFor(DOCTORS[0].name)}`)
        console.log(`\n  Undo: npx tsx prisma/seed-doctors.ts --remove --commit\n`)
    } finally {
        await prisma.$disconnect()
    }
}

main().catch((error) => {
    console.error('\nSeed failed:', error)
    process.exitCode = 1
})
