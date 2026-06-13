import { describe, it, expect } from 'vitest'
import { validateEndTime } from '@/lib/validation'

describe('validateEndTime', () => {
  it('passes when either time is absent', () => {
    expect(validateEndTime('18:00', '')).toBeNull()
    expect(validateEndTime('', '21:00')).toBeNull()
    expect(validateEndTime('18:00', undefined)).toBeNull()
  })
  it('passes for a normal range', () => {
    expect(validateEndTime('18:00', '21:00')).toBeNull()
  })
  it('rejects an end time before the start', () => {
    expect(validateEndTime('18:00', '17:00')).toBe('End time must be after start time')
  })
  it('rejects an end time equal to the start', () => {
    expect(validateEndTime('18:00', '18:00')).toBe('End time must be after start time')
  })
  it('allows exactly 12 hours', () => {
    expect(validateEndTime('06:00', '18:00')).toBeNull()
  })
  it('rejects more than 12 hours', () => {
    expect(validateEndTime('06:00', '18:01')).toBe('End time must be within 12 hours of start time')
  })
})
