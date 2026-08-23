import { AITool, ToolResult } from '../ToolRegistry';
import { AppointmentContextService } from '../context/appointmentContext';
import prisma from '@/lib/prisma';
import { parseSlotDateTime } from '@/lib/appointment';
import { formatDob, formatPhone, formatAddress, isGenderSet, normalizeGender } from '@/lib/profile';

/**
 * Every tool here backs one of Aether's answer categories with the patient's real record.
 * These used to return fixed sample data (the same fake medications and lab results for
 * every patient, regardless of who was asking) — a healthcare assistant fabricating a
 * blood test result a patient never had is a genuine safety problem, not a cosmetic one.
 * The system prompt already forbids the model from inventing data; the missing half was
 * feeding it real data to work with instead of nothing.
 *
 * Where MediCare genuinely has no data source for a category (lab reports, a computed
 * "health score" — neither is a feature this app has), the tool says so honestly rather
 * than inventing a plausible-looking substitute.
 */

const dateLabel = (date: Date) =>
    date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });

export class AppointmentTool implements AITool {
    name = 'AppointmentTool';
    description = "Retrieves the authenticated patient's appointments";

    async execute(userId: string): Promise<ToolResult> {
        try {
            const data = await AppointmentContextService.getContext(userId);
            return { success: true, type: 'appointment', data };
        } catch (error) {
            console.error('[AppointmentTool] Error:', error);
            return { success: false, type: 'appointment', data: null };
        }
    }
}

export class PrescriptionTool implements AITool {
    name = 'PrescriptionTool';
    description = "Retrieves the patient's real prescriptions — scanned uploads and what a doctor prescribed during a consultation.";

    async execute(userId: string): Promise<ToolResult> {
        try {
            const [scanned, consultations] = await Promise.all([
                prisma.prescription.findMany({
                    where: { userId },
                    orderBy: { createdAt: 'desc' },
                    select: { medicines: true, rawText: true, notes: true, isVerified: true, createdAt: true },
                }),
                prisma.appointment.findMany({
                    where: { userId, isCompleted: true, NOT: { prescription: null } },
                    include: { doctor: { select: { name: true, speciality: true } } },
                }),
            ]);

            const data: Record<string, unknown>[] = [];

            for (const p of scanned) {
                const medicines = Array.isArray(p.medicines) ? p.medicines : [];
                const entry: Record<string, unknown> = {
                    source: 'Scanned prescription',
                    date: dateLabel(p.createdAt),
                    verified: p.isVerified,
                };
                if (medicines.length > 0) entry.medicines = medicines;
                else if (p.rawText) entry.text = p.rawText;
                else continue; // Nothing readable was extracted — not worth surfacing.
                if (p.notes) entry.notes = p.notes;
                data.push(entry);
            }

            for (const a of consultations) {
                // The Prisma filter below only excludes NULL — a doctor can complete a
                // consultation with the prescription field left as an empty string, which
                // is not null and would otherwise reach the model as a blank entry.
                if (!a.prescription?.trim()) continue;
                const parsedDate = parseSlotDateTime(a.slotDate, a.slotTime);
                data.push({
                    source: `Consultation with ${a.doctor.name} (${a.doctor.speciality || 'General'})`,
                    date: parsedDate ? dateLabel(parsedDate) : a.slotDate,
                    prescription: a.prescription,
                });
            }

            if (data.length === 0) {
                return {
                    success: true,
                    type: 'prescription',
                    data: { available: false, reason: 'No prescriptions are on file for this patient yet.' },
                };
            }

            return { success: true, type: 'prescription', data };
        } catch (error) {
            console.error('[PrescriptionTool] Error:', error);
            return { success: false, type: 'prescription', data: null };
        }
    }
}

export class ReportTool implements AITool {
    name = 'ReportTool';
    description = "Retrieves the patient's lab results and imaging reports, if any exist.";

    async execute(): Promise<ToolResult> {
        // MediCare has no lab-report or imaging-upload feature — there is no real data
        // source behind this tool. Returning fabricated results (the previous behaviour)
        // meant inventing blood-test values for a test the patient never took. Saying so
        // honestly lets the model apply its "acknowledge missing data" rule truthfully
        // instead of presenting invented findings as real ones.
        return {
            success: true,
            type: 'medical_report',
            data: {
                available: false,
                reason: 'MediCare does not currently support uploading or storing lab results or imaging reports.',
            },
        };
    }
}

export class TimelineTool implements AITool {
    name = 'TimelineTool';
    description = "Retrieves the patient's real healthcare timeline from completed consultations.";

    async execute(userId: string): Promise<ToolResult> {
        try {
            const completed = await prisma.appointment.findMany({
                where: { userId, isCompleted: true },
                include: { doctor: { select: { name: true, speciality: true } } },
            });

            if (completed.length === 0) {
                return {
                    success: true,
                    type: 'timeline',
                    data: { available: false, reason: 'No completed consultations are on file yet.' },
                };
            }

            const events = completed
                .map((a) => ({ ...a, parsedDate: parseSlotDateTime(a.slotDate, a.slotTime) ?? new Date(0) }))
                .sort((x, y) => y.parsedDate.getTime() - x.parsedDate.getTime())
                .map((a) => {
                    const event: Record<string, unknown> = {
                        date: dateLabel(a.parsedDate),
                        doctor: `${a.doctor.name} (${a.doctor.speciality || 'General'})`,
                    };
                    if (a.diagnosis) event.diagnosis = a.diagnosis;
                    if (a.prescription) event.prescription = a.prescription;
                    if (a.followUpDate) event.followUp = dateLabel(new Date(a.followUpDate));
                    return event;
                });

            return { success: true, type: 'timeline', data: events };
        } catch (error) {
            console.error('[TimelineTool] Error:', error);
            return { success: false, type: 'timeline', data: null };
        }
    }
}

export class ProfileTool implements AITool {
    name = 'ProfileTool';
    description = "Retrieves the authenticated patient's own profile details.";

    async execute(userId: string): Promise<ToolResult> {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    name: true,
                    email: true,
                    phone: true,
                    gender: true,
                    dob: true,
                    address: true,
                    heightCm: true,
                    weightKg: true,
                    bloodGroup: true,
                    allergies: true,
                },
            });
            if (!user) return { success: false, type: 'profile', data: null };

            // Several of these columns default to a placeholder sentinel ("Not Selected",
            // the literal phone "0000000000") rather than null, precisely so the dashboard
            // never displays a fake value as if the patient had entered it. The same rule
            // applies here — an unset field is omitted, not handed to the model as data.
            const data: Record<string, unknown> = { name: user.name, email: user.email };
            if (isGenderSet(user.gender)) data.gender = normalizeGender(user.gender);
            const dob = formatDob(user.dob);
            if (dob !== 'Not provided') data.dateOfBirth = dob;
            const phone = formatPhone(user.phone);
            if (phone !== 'Not provided') data.phone = phone;
            const address = formatAddress(user.address);
            if (address !== 'Not provided') data.address = address;
            if (user.heightCm) data.heightCm = user.heightCm;
            if (user.weightKg) data.weightKg = user.weightKg;
            if (user.bloodGroup) data.bloodGroup = user.bloodGroup;
            if (user.allergies?.trim()) data.allergies = user.allergies.trim();

            return { success: true, type: 'profile', data };
        } catch (error) {
            console.error('[ProfileTool] Error:', error);
            return { success: false, type: 'profile', data: null };
        }
    }
}

export class HealthSummaryTool implements AITool {
    name = 'HealthSummaryTool';
    description = "Builds a summary of the patient's record from data actually on file — never a fabricated score.";

    async execute(userId: string): Promise<ToolResult> {
        try {
            const [user, latestCompleted] = await Promise.all([
                prisma.user.findUnique({
                    where: { id: userId },
                    select: { heightCm: true, weightKg: true, bloodGroup: true, allergies: true },
                }),
                prisma.appointment.findFirst({
                    where: { userId, isCompleted: true },
                    orderBy: { updatedAt: 'desc' },
                    include: { doctor: { select: { name: true, speciality: true } } },
                }),
            ]);
            if (!user) return { success: false, type: 'health_summary', data: null };

            const data: Record<string, unknown> = {
                // MediCare has no clinical scoring feature. The old fixed "score: 87" was
                // the same number for every patient regardless of their actual record —
                // that's not a summary, it's a fabricated statistic. This note tells the
                // model plainly not to invent one either.
                note: 'MediCare does not compute a numeric health score. This summary reflects only what is on file — for a real assessment, the patient should ask their doctor.',
            };

            if (user.heightCm && user.weightKg) {
                const heightM = user.heightCm / 100;
                data.bmi = Math.round((user.weightKg / (heightM * heightM)) * 10) / 10;
            }
            if (user.bloodGroup) data.bloodGroup = user.bloodGroup;
            if (user.allergies?.trim()) data.allergies = user.allergies.trim();

            if (latestCompleted) {
                const parsedDate = parseSlotDateTime(latestCompleted.slotDate, latestCompleted.slotTime);
                const recent: Record<string, unknown> = {
                    date: parsedDate ? dateLabel(parsedDate) : latestCompleted.slotDate,
                    doctor: `${latestCompleted.doctor.name} (${latestCompleted.doctor.speciality || 'General'})`,
                };
                if (latestCompleted.diagnosis) recent.diagnosis = latestCompleted.diagnosis;
                if (latestCompleted.followUpDate) recent.followUp = dateLabel(new Date(latestCompleted.followUpDate));
                data.mostRecentConsultation = recent;
            }

            return { success: true, type: 'health_summary', data };
        } catch (error) {
            console.error('[HealthSummaryTool] Error:', error);
            return { success: false, type: 'health_summary', data: null };
        }
    }
}
