import type { DocumentSnapshot, Firestore } from 'firebase-admin/firestore'

// What one person can reach, mirroring firestore.rules: everything under users/{uid}, plus shared projects
// they own or are still a member of (with those projects' tasks).

export async function sharedProjects(db: Firestore, uid: string) {
  const user = db.collection('users').doc(uid)
  const [owned, joined] = await Promise.all([user.collection('projects').where('shared', '==', true).get(), user.collection('joined').get()])
  // A joined pointer can outlive membership (removed, or sharing stopped), so check the project itself.
  const joinedProjects = await Promise.all(
    joined.docs
      .filter((j) => typeof j.get('owner') === 'string' && j.get('owner'))
      .map((j) => db.collection('users').doc(j.get('owner')).collection('projects').doc(j.id).get()),
  )
  const member = joinedProjects.filter((p) => p.exists && p.get('shared') && (p.get('members') ?? []).includes(uid))
  return { owned: owned.docs as DocumentSnapshot[], joined: member }
}

// Their own tasks plus tasks in every shared project they own or have joined.
export async function taskSnapshots(db: Firestore, uid: string, shared?: Awaited<ReturnType<typeof sharedProjects>>) {
  const projects = shared ?? (await sharedProjects(db, uid))
  const own = db.collection('users').doc(uid).collection('tasks')
  const snaps = await Promise.all([own.get(), ...[...projects.owned, ...projects.joined].map((p) => p.ref.collection('tasks').get())])
  return snaps.flatMap((s) => s.docs)
}
