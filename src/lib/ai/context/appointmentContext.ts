import prisma from '@/lib/prisma';

export class AppointmentContextService {
    public static async getContext(userId: string) {
        try {
            const appointments = await prisma.appointment.findMany({
                where: { userId },
                // Only the two fields `formatAppointment` renders. `doctor: true` pulled the
                // whole row — including the doctor's password hash — into the context object
                // that gets serialised into the Gemini prompt.
                include: { doctor: { select: { name: true, speciality: true } } }
            });

            if (appointments.length === 0) {
                return {
                    summary: "No appointments found.",
                    history: []
                };
            }

            const now = new Date();
            
            // Map with parsed dates
            const parsedAppointments = appointments.map(app => {
                const [day, month, year] = app.slotDate.split('_').map(Number);
                
                // Try to parse time (e.g. "10:30 AM")
                let hours = 0;
                let minutes = 0;
                if (app.slotTime) {
                    const match = app.slotTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
                    if (match) {
                        let h = parseInt(match[1]);
                        const m = parseInt(match[2]);
                        const isPM = match[3].toUpperCase() === 'PM';
                        if (isPM && h !== 12) h += 12;
                        if (!isPM && h === 12) h = 0;
                        hours = h;
                        minutes = m;
                    }
                }
                
                const appointmentDate = new Date(year, month - 1, day, hours, minutes);
                return { ...app, parsedDate: appointmentDate };
            });
            
            // Sort by parsed date descending (newest first)
            parsedAppointments.sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime());

            // 1. Upcoming appointments include all future appointments (not cancelled, not completed)
            const upcomingAppointments = parsedAppointments.filter(a => 
                !a.cancelled && !a.isCompleted && a.parsedDate.getTime() > now.getTime()
            );

            // Sort upcoming ascending (nearest future first)
            upcomingAppointments.sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

            // 2. Completed/Past
            const pastAppointments = parsedAppointments.filter(a => 
                a.isCompleted || a.cancelled || a.parsedDate.getTime() <= now.getTime()
            );

            // "Scheduled appointments must never be treated as completed consultations."
            // "Latest Consultation should only include completed appointments."
            const completedAppointments = pastAppointments.filter(a => a.isCompleted);
            
            const latestAppointment = completedAppointments.length > 0 ? completedAppointments[0] : null;

            // "The same appointment must never appear in multiple sections."
            // "Appointment History should contain only completed, cancelled, or missed appointments."
            const historyAppointments = pastAppointments
                .filter(a => latestAppointment ? a.id !== latestAppointment.id : true)
                .slice(0, 5); // Take top 5

            const result: any = {};

            if (upcomingAppointments.length > 0) {
                result.upcoming = upcomingAppointments.map(a => this.formatAppointment(a));
            }

            if (latestAppointment) {
                result.latest_consultation = this.formatAppointment(latestAppointment);
            }

            if (historyAppointments.length > 0) {
                result.history = historyAppointments.map(a => this.formatAppointment(a));
            }

            return result;
        } catch (error) {
            console.error('[AppointmentContextService] Error:', error);
            throw new Error('Failed to retrieve appointment context.');
        }
    }

    private static formatFriendlyDate(slotDate: string): string {
        try {
            const [day, month, year] = slotDate.split('_').map(Number);
            const date = new Date(year, month - 1, day);
            if (isNaN(date.getTime())) return slotDate;
            return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
        } catch {
            return slotDate;
        }
    }

    private static formatAppointment(app: any) {
        // "Never display null values. Hide empty fields..."
        // "Doctor information is currently rendered as '[object Object]'. Extract and display the doctor's name and specialization correctly."
        const formatted: Record<string, any> = {
            date: this.formatFriendlyDate(app.slotDate),
            time: app.slotTime,
            status: app.cancelled ? 'Cancelled' : (app.isCompleted ? 'Completed' : (app.parsedDate.getTime() < Date.now() ? 'Missed' : 'Scheduled')),
            doctor: app.doctor ? `${app.doctor.name} (${app.doctor.speciality || 'General'})` : 'Unknown'
        };

        if (app.diagnosis) formatted.diagnosis = app.diagnosis;
        if (app.prescription) formatted.recommendations = app.prescription;
        if (app.notes) formatted.notes = app.notes;
        
        if (app.followUpDate) {
            const fDate = new Date(app.followUpDate);
            if (!isNaN(fDate.getTime())) {
                formatted.followUp = fDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
            }
        }

        return formatted;
    }
}
