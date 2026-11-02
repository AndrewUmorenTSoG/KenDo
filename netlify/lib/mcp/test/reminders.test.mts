import { beforeEach, describe, expect, it } from 'vitest'
import sendReminders from '../../../functions/send-reminders.mts'
import { call, clearDb, connect, db, hasEmulator, mcpClient, seedUser } from './helpers.mts'

describe.skipIf(!hasEmulator)('reminders reach the existing scheduled sender (10)', () => {
  beforeEach(clearDb)

  it('a reminder set over MCP is picked up once by send-reminders, and a retry does not resend it', async () => {
    await seedUser('kenny', { nudges: false })
    const { tokens } = await connect('kenny')
    const mcp = await mcpClient(tokens.access_token)
    const t = await call(mcp, 'create_task', { title: 'Speak to Mum', date: '2030-01-01', idempotency_key: 'mum-call-1' })
    await call(mcp, 'create_task', { title: 'Speak to Mum', date: '2030-01-01', idempotency_key: 'mum-call-1' })
    // Pretend its time has come.
    const ref = db().collection('users').doc('kenny').collection('tasks').doc(t.result.id)
    await ref.update({ remindAt: Date.now() - 1000 })
    const first = await (await sendReminders()).text()
    expect(first).toMatch(/^Sent 1 reminders/)
    expect((await ref.get()).get('reminderSent')).toBe(true)
    const second = await (await sendReminders()).text()
    expect(second).toMatch(/^Sent 0 reminders/)
    // A cancelled reminder is never sent.
    await call(mcp, 'set_reminder', { task_id: t.result.id, at: '2031-01-01T09:00' })
    await call(mcp, 'cancel_reminder', { task_id: t.result.id })
    await ref.update({ remindAt: null })
    expect(await (await sendReminders()).text()).toMatch(/^Sent 0 reminders/)
  })
})
