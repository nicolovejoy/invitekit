'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { doc, getDoc, updateDoc, deleteField, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import OrganizerRoute from '@/components/OrganizerRoute'
import EventForm from '@/components/EventForm'
import { Alert, AlertDescription } from '@/components/ui/alert'

function EditEventContent() {
  const { eventId } = useParams()
  const router = useRouter()
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    getDoc(doc(db, 'events', eventId))
      .then(d => {
        if (!d.exists()) return router.replace('/dashboard')
        const data = d.data()
        setForm({
          title: data.title ?? '',
          date: data.date ?? '',
          time: data.time ?? '',
          endTime: data.endTime ?? '',
          location: data.location ?? '',
          description: data.description ?? '',
          maxGuests: data.maxGuests ?? '',
        })
      })
      .catch(err => setError(err.message))
  }, [eventId, router])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const { maxGuests, endTime, ...rest } = form
      const updateData = { ...rest, updatedAt: serverTimestamp() }
      updateData.maxGuests = maxGuests !== '' ? Number(maxGuests) : deleteField()
      updateData.endTime = endTime !== '' ? endTime : deleteField()
      await updateDoc(doc(db, 'events', eventId), updateData)
      router.push(`/events/${eventId}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (error) return (
    <main className="max-w-lg mx-auto p-4">
      <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
    </main>
  )
  if (!form) return null

  return (
    <main className="max-w-lg mx-auto p-4">
      <EventForm
        form={form}
        onChange={setForm}
        onSubmit={handleSubmit}
        submitLabel="Save Changes"
        onCancel={() => router.push(`/events/${eventId}`)}
        loading={loading}
      />
    </main>
  )
}

export default function EditEventPage() {
  return (
    <OrganizerRoute>
      <EditEventContent />
    </OrganizerRoute>
  )
}
