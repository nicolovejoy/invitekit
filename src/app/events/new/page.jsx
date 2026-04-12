'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import OrganizerRoute from '@/components/OrganizerRoute'
import EventForm from '@/components/EventForm'

function CreateEventContent() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '',
    date: '',
    time: '18:00',
    endTime: '',
    timezone: 'America/Los_Angeles',
    location: '',
    description: '',
    maxGuests: '',
  })

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const { maxGuests, endTime, ...rest } = form
      const docData = {
        ...rest,
        status: 'draft',
        createdBy: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
      if (maxGuests !== '') docData.maxGuests = Number(maxGuests)
      if (endTime !== '') docData.endTime = endTime
      const ref = await addDoc(collection(db, 'events'), docData)
      router.push(`/events/${ref.id}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="max-w-lg mx-auto p-4">
      <EventForm
        form={form}
        onChange={setForm}
        onSubmit={handleSubmit}
        submitLabel="Create Event"
        loading={loading}
      />
    </main>
  )
}

export default function CreateEventPage() {
  return (
    <OrganizerRoute>
      <CreateEventContent />
    </OrganizerRoute>
  )
}
