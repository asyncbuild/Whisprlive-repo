export const PLAN_LIMITS = {
  SOLO: {
    monthlySessions: 3,
    maxDurationMinutes: 15,
    maxMessages: 15,
    canSchedule: false,
    canExport: false,
    historyRetentionDays: 7,
    isAvailable: true,
  },
  ROOM_PASS: {
    monthlySessions: Infinity,
    maxDurationMinutes: 1440, // 24 hours
    maxMessages: 500,
    canSchedule: true,
    canExport: true,
    historyRetentionDays: 30,
    isAvailable: true,
  },
  HOST: {
    monthlySessions: Infinity,
    maxDurationMinutes: 60,
    maxMessages: 1000,
    canSchedule: true,
    canExport: true,
    historyRetentionDays: 90,
    isAvailable: false, // Coming soon / Notify waitlist
  },
  STUDIO: {
    monthlySessions: Infinity,
    maxDurationMinutes: 120,
    maxMessages: 2500,
    canSchedule: true,
    canExport: true,
    historyRetentionDays: 365,
    isAvailable: false, // Coming soon / Notify waitlist
  },
};