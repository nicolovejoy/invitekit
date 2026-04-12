'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import TimeInput from '@/components/TimeInput'
import { US_TIMEZONES } from '@/lib/constants'

function validateEndTime(startTime, endTime) {
  if (!endTime || !startTime) return null
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const startMins = sh * 60 + sm
  const endMins = eh * 60 + em
  if (endMins <= startMins) return 'End time must be after start time'
  const diff = endMins - startMins
  if (diff > 12 * 60) return 'End time must be within 12 hours of start time'
  return null
}

export default function EventForm({ form, onChange, onSubmit, submitLabel, onCancel, loading }) {
  const [endTimeError, setEndTimeError] = useState(null)
  const [dateError, setDateError] = useState(null)
  const today = new Date().toLocaleDateString('en-CA')
  const minDate = form.date && form.date < today ? form.date : today

  function handleChange(e) {
    const updated = { ...form, [e.target.name]: e.target.value }
    onChange(updated)
    if (e.target.name === 'endTime' || e.target.name === 'time') {
      setEndTimeError(validateEndTime(
        e.target.name === 'time' ? e.target.value : updated.time,
        e.target.name === 'endTime' ? e.target.value : updated.endTime,
      ))
    }
  }

  function handleSubmit(e) {
    const today = new Date().toLocaleDateString('en-CA')
    if (form.date < today) {
      e.preventDefault()
      setDateError('Event date cannot be in the past')
      return
    }
    const err = validateEndTime(form.time, form.endTime)
    if (err) {
      e.preventDefault()
      setEndTimeError(err)
      return
    }
    setDateError(null)
    onSubmit(e)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{submitLabel === 'Save Changes' ? 'Edit Event' : 'New Event'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" value={form.title} onChange={handleChange} required />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" name="date" type="date" value={form.date} onChange={handleChange} required min={minDate} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Start time</Label>
              <TimeInput id="time" name="time" value={form.time} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">
                End time <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <TimeInput id="endTime" name="endTime" value={form.endTime} onChange={handleChange} />
            </div>
          </div>
          {dateError && <p className="text-sm text-destructive">{dateError}</p>}
          {endTimeError && <p className="text-sm text-destructive">{endTimeError}</p>}
          <div className="space-y-2">
            <Label htmlFor="timezone">Time zone</Label>
            <select
              id="timezone"
              name="timezone"
              value={form.timezone || 'America/Los_Angeles'}
              onChange={handleChange}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              {US_TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input id="location" name="location" value={form.location} onChange={handleChange} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea id="description" name="description" value={form.description} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxGuests">Max guests <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input id="maxGuests" name="maxGuests" type="number" min="1" value={form.maxGuests} onChange={handleChange} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : submitLabel}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
