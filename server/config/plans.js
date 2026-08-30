export const PLAN_LIMITS = {
    SOLO: {
        monthlySessions: 3,
        maxDurationMinutes: 15,
        maxGuests: 50,
        canExport: false,
    },
    HOST: {
        monthlySessions: Infinity,
        maxDurationMinutes: 60,
        maxGuests: 1000,
        canExport: true,
    },
    STUDIO :{
        monthlySessions: Infinity,
        maxDurationMinutes: 120,
        maxGuests: 5000,
        canExport: true,
    }
}