export const PLAN_LIMITS = {
  SOLO: {
    monthlySessions: Infinity,
    maxDurationMinutes: 15,
    maxMessages: 100,
    maxPollTemplates: 2,
    canSchedule: false,
    canExport: false,
    historyRetentionDays: 7,
    isAvailable: true,
  },
  ROOM_PASS: {
    monthlySessions: Infinity,
    maxDurationMinutes: 1440, // 24 hours
    maxMessages: 500,
    maxPollTemplates: Infinity,
    canSchedule: true,
    canExport: true,
    historyRetentionDays: 30,
    isAvailable: true,
  },
  HOST: {
    monthlySessions: Infinity,
    maxDurationMinutes: 60,
    maxMessages: 1000,
    maxPollTemplates: Infinity,
    canSchedule: true,
    canExport: true,
    historyRetentionDays: 90,
    isAvailable: false, // Coming soon / Notify waitlist
  },
  STUDIO: {
    monthlySessions: Infinity,
    maxDurationMinutes: 120,
    maxMessages: 2500,
    maxPollTemplates: Infinity,
    canSchedule: true,
    canExport: true,
    historyRetentionDays: 365,
    isAvailable: false, // Coming soon / Notify waitlist
  },
};