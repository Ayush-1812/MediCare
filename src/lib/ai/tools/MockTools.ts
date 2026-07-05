import { AITool, ToolResult } from '../ToolRegistry';
import { AppointmentContextService } from '../context/appointmentContext';

export class AppointmentTool implements AITool {
    name = 'AppointmentTool';
    description = 'Retrieves the authenticated user\'s appointments';

    async execute(userId: string, parameters?: Record<string, unknown>): Promise<ToolResult> {
        try {
            const data = await AppointmentContextService.getContext(userId);
            return {
                success: true,
                type: 'appointment',
                data: data
            };
        } catch (error) {
            console.error('[AppointmentTool] Error:', error);
            return {
                success: false,
                type: 'appointment',
                data: 'Failed to retrieve appointments.'
            };
        }
    }
}

export class PrescriptionTool implements AITool {
    name = 'PrescriptionTool';
    description = 'Retrieves user prescriptions and medications';

    async execute(userId: string, parameters?: any): Promise<any> {
        return {
            source: this.name,
            data: [
                { medicine: 'Lisinopril', dosage: '10mg', frequency: 'Daily, morning' },
                { medicine: 'Atorvastatin', dosage: '20mg', frequency: 'Daily, evening' }
            ]
        };
    }
}

export class ReportTool implements AITool {
    name = 'ReportTool';
    description = 'Retrieves user medical reports and lab results';

    async execute(userId: string, parameters?: any): Promise<any> {
        return {
            source: this.name,
            data: [
                { test: 'Complete Blood Count', date: '2026-06-01', status: 'Normal' },
                { test: 'Lipid Panel', date: '2026-06-01', status: 'Borderline High Cholesterol' }
            ]
        };
    }
}

export class TimelineTool implements AITool {
    name = 'TimelineTool';
    description = 'Retrieves user health timeline';

    async execute(userId: string, parameters?: any): Promise<any> {
        return {
            source: this.name,
            data: [
                { event: 'Diagnosed with mild hypertension', date: '2026-01-15' },
                { event: 'Prescribed Lisinopril', date: '2026-01-15' }
            ]
        };
    }
}

export class ProfileTool implements AITool {
    name = 'ProfileTool';
    description = 'Retrieves user profile details';

    async execute(userId: string, parameters?: any): Promise<any> {
        return {
            source: this.name,
            data: {
                name: 'Mock User',
                email: 'mock@example.com',
                gender: 'Male',
                dob: '1985-05-20'
            }
        };
    }
}

export class HealthSummaryTool implements AITool {
    name = 'HealthSummaryTool';
    description = 'Retrieves an overall health summary score';

    async execute(userId: string, parameters?: any): Promise<any> {
        return {
            source: this.name,
            data: {
                score: 87,
                status: 'Good. Keep up the healthy habits.',
                recommendations: ['Monitor blood pressure daily.', 'Reduce sodium intake.']
            }
        };
    }
}
