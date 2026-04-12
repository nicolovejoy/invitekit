# InviteKit — User Stories

> These stories were originally written for the Freevite reference deployment. They describe the product the open-source codebase implements.


## Event Creator (Organizer)

### Account & Access

- As an organizer, I can sign in with Google so that I have a persistent, secure account.
- As an organizer, I am rejected if my email is not on the approved list, so the app stays private.

### Event Management

- As an organizer, I can create an event with a title, date, time, location, and description.
- As an organizer, I can see all my events on a dashboard with headcount summaries at a glance.
- As an organizer, I can edit an event after creating it (title, date, time, location, description).
- As an organizer, I can cancel or delete an event and notify guests automatically.

### Guest Management

- As an organizer, I can add guests by name and email.
- As an organizer, I can send a personalized invite email to a guest via the app.
- As an organizer, I can resend an invite to a guest who hasn't responded.
- As an organizer, I can remove a guest from an event.
- As an organizer, I can see each guest's RSVP status and party size in real time.
- As an organizer, I can see a total headcount (attending, maybe, declined, pending) for each event.

### Comments & Communication

- As an organizer, I can see all comments — public and private — on the event detail page.
- As an organizer, I can post a comment or announcement visible to all guests.

---

## Event Participant (Guest)

### Access

- As a guest, I receive a unique magic link via email that grants me access to my RSVP page.
- As a guest, I do not need to create an account or remember a password.
- As a guest, I can return to my RSVP link at any time to update my response.

### RSVP

- As a guest, I can RSVP as attending, maybe, or declined.
- As a guest, I see a clear prompt to respond with no pre-selected status.
- As a guest, I can specify how many people are in my party.
- As a guest, I can change my RSVP or party size at any time before the event.

### Comments

- As a guest, I can leave a comment (e.g., dietary notes, a message to the host).
- As a guest, I can choose whether my comment is visible to other guests or private to the organizer.
- As a guest, I can update my comment if I return to my RSVP link.
- As a guest, I can see public comments from other guests on my RSVP page.
- As a guest, after responding I see a colored status banner confirming my RSVP.
- As a guest, I can optionally link my Google account to preserve access across devices.

---

## Open Questions / Not Yet Decided

- Should guests be able to see each other's names on the RSVP page before they RSVP? [yes, for now]
- Should the organizer be able to post event updates that get emailed to attending guests? [yes, eventually]
- Should there be a waitlist if the event is full? - no
- ~~Should guests be able to upgrade to a Google account?~~ Done — linkWithPopup on RSVP page
- Should guests receive a reminder email as the event approaches? yes indeed
- Should declined guests be able to un-decline? yup. perhaps the invite email is updated to let them know the link stays valid up until the event. which means after the event is over, we need it not to be valid.
- Should the organizer be able to set a max headcount? sure, yes.
