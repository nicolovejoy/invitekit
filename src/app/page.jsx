'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function Home() {
  const { user, isOrganizer, loading } = useAuth()
  const router = useRouter()
  const [form, setForm] = useState({ email: '', name: '', howFound: '', comments: '' })
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && user && isOrganizer) router.push('/dashboard')
  }, [user, isOrganizer, loading, router])

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError(null)
    setSubmitting(true)
    try {
      await addDoc(collection(db, 'waitlist'), {
        email: form.email,
        name: form.name || null,
        howFound: form.howFound || null,
        comments: form.comments || null,
        createdAt: serverTimestamp(),
      })
      setSubmitted(true)
    } catch {
      setSubmitError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return null

  return (
    <main className="max-w-2xl mx-auto px-4 py-16 space-y-16">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight">Simple invite management</h1>
            <p className="text-lg text-muted-foreground max-w-md">
              Send invitations, collect RSVPs, and keep track of who's coming — no accounts required for guests.
            </p>
          </div>
        </div>

        <div className="max-w-md mx-auto space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Stay in the loop</h2>
            <p className="text-sm text-muted-foreground mt-1">
              We're building something here. Leave your email and we'll let you know when it opens up.
            </p>
          </div>
          {submitted ? (
            <Alert>
              <AlertDescription>Thanks — we'll be in touch.</AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="name">
                  Name <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="howFound">
                  How did you find us? <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="howFound"
                  value={form.howFound}
                  onChange={e => setForm(f => ({ ...f, howFound: e.target.value }))}
                  placeholder="Friend, search, social media..."
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="comments">
                  Anything to share? <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="comments"
                  value={form.comments}
                  onChange={e => setForm(f => ({ ...f, comments: e.target.value }))}
                  placeholder="What would you use this for?"
                />
              </div>
              {submitError && (
                <Alert variant="destructive">
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Sending...' : 'Notify me'}
              </Button>
            </form>
          )}
        </div>
    </main>
  )
}
