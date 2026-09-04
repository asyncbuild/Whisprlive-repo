export const PLAN_LIMITS = {
  SOLO: {
    monthlySessions: 3,
    maxDurationMinutes: 15,
    maxMessages: 25,
    maxGuests: 25,
    canExport: false,
  },
  ROOM_PASS: {
    monthlySessions: Infinity,
    maxMessages: 500,
    maxGuests: 500,
    maxDurationMinutes: 1440, // 24 hours
    canExport: true,
  },
  HOST: {
    monthlySessions: Infinity,
    maxDurationMinutes: 60,
    maxMessages: 1000,
    maxGuests: 1000,
    canExport: true,
  },
  STUDIO: {
    monthlySessions: Infinity,
    maxDurationMinutes: 120,
    maxMessages: 2500,
    maxGuests: 2500,
    canExport: true,
  },
};