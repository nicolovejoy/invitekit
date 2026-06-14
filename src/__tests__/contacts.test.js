import { describe, it, expect } from 'vitest'
import { parseContact, isEmail } from '@/lib/contacts'

describe('parseContact', () => {
  it('splits "Name <email>" into parts', () => {
    expect(parseContact('First Last <f@a.co>')).toEqual({ name: 'First Last', email: 'f@a.co' })
  })
  it('trims surrounding whitespace', () => {
    expect(parseContact('  Ann Lee  < ann@x.com >  ')).toEqual({ name: 'Ann Lee', email: 'ann@x.com' })
  })
  it('returns null for a bare name', () => {
    expect(parseContact('Just A Name')).toBeNull()
  })
  it('returns null for a bare email', () => {
    expect(parseContact('a@b.co')).toBeNull()
  })
  it('returns null for angle brackets without an @', () => {
    expect(parseContact('Bob <not-an-email>')).toBeNull()
  })
})

describe('isEmail', () => {
  it('accepts a normal address (with surrounding space)', () => {
    expect(isEmail('  a@b.co ')).toBe(true)
  })
  it('rejects a name', () => {
    expect(isEmail('First Last')).toBe(false)
  })
  it('rejects an address without a dot in the domain', () => {
    expect(isEmail('a@b')).toBe(false)
  })
  it('rejects the "Name <email>" form', () => {
    expect(isEmail('Ann <a@b.co>')).toBe(false)
  })
})
