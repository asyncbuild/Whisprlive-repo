export const PLAN_LIMITS = {
  SOLO: {
    monthlySessions: 3,
    maxDurationMinutes: 15,
    maxGuests: 50,
    canExport: false,
  },
  ROOM_PASS: {
    monthlySessions: Infinity,
    maxGuests: 500,
    maxDurationMinutes: 1440, // 24 hours
    canExport: true,
  },
  HOST: {
    monthlySessions: Infinity,
    maxDurationMinutes: 60,
    maxGuests: 1000,
    canExport: true,
  },
  STUDIO: {
    monthlySessions: Infinity,
    maxDurationMinutes: 120,
    maxGuests: 5000,
    canExport: true,
  },
};