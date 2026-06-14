import { useEffect, useState } from 'react'
import {
  doc, getDoc, collection, query, where, orderBy, onSnapshot,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

/** Subscribe to an event and its invites + comments in real time.
 *  Returns { event, setEvent, invites, comments, error }. */
export function useEvent(eventId) {
  const [event, setEvent] = useState(null)
  const [invites, setInvites] = useState([])
  const [comments, setComments] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    getDoc(doc(db, 'events', eventId))
      .then(d => setEvent({ id: d.id, ...d.data() }))
      .catch(err => setError(err.message))

    const invitesQ = query(
      collection(db, 'invites'),
      where('eventId', '==', eventId),
      orderBy('createdAt')
    )
    const commentsQ = query(
      collection(db, 'comments'),
      where('eventId', '==', eventId),
      orderBy('createdAt')
    )

    const unsubInvites = onSnapshot(invitesQ,
      snap => setInvites(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => setError(err.message)
    )
    const unsubComments = onSnapshot(commentsQ,
      snap => setComments(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => setError(err.message)
    )

    return () => { unsubInvites(); unsubComments() }
  }, [eventId])

  return { event, setEvent, invites, comments, error }
}
