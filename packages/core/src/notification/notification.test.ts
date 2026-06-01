import { describe, expect, it } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db'
import { NotificationType } from '@shumai/db'
import { notificationService } from './notification'
import { userMetadataService } from '@shumai/core/src/user-metadata/user-metadata'

describe('NotificationService', () => {
  setupTestDbHooks()

  it('Create basic notification', async () => {
    const tm = await prisma.team.create({ data: { name: 'Team 1' } })
    const u1 = await prisma.user.create({
      data: { name: 'u1', email: `u1-${Date.now()}@example.com`, password: 'p' },
    })
    const p = await prisma.project.create({ data: { name: 'Project 1', teamId: tm.id } })

    const svc = notificationService

    await svc['createAsync']({
      type: NotificationType.comment_created,
      teamId: tm.id,
      projectId: p.id,
      creatorId: u1.id,
    })

    const count = await prisma.notification.count()
    expect(count).toBe(1)

    const n = await prisma.notification.findFirst()
    expect(n?.type).toBe(NotificationType.comment_created)
    expect(n?.teamId).toBe(tm.id)
    expect(n?.projectId).toBe(p.id)
    expect(n?.creatorId).toBe(u1.id)
  })

  it('Create mention notification', async () => {
    const tm = await prisma.team.create({ data: { name: 'Team 1' } })
    const u1 = await prisma.user.create({
      data: { name: 'u1', email: 'u1-mention@example.com', password: 'p' },
    })
    const u2 = await prisma.user.create({
      data: { name: 'u2', email: 'u2-mention@example.com', password: 'p' },
    })
    const p = await prisma.project.create({ data: { name: 'Project 1', teamId: tm.id } })

    const svc = notificationService
    const msg = `Hello <@${u2.id}>`

    await svc['createAsync']({
      type: NotificationType.comment_created,
      teamId: tm.id,
      projectId: p.id,
      creatorId: u1.id,
      commentMessage: msg,
    })

    const count = await prisma.notification.count()
    expect(count).toBe(2) // 1 comment, 1 mention

    const mentions = await prisma.notification.findMany({
      where: { type: NotificationType.mention },
    })
    expect(mentions).toHaveLength(1)
    expect(mentions[0].userId).toBe(u2.id)
  })

  it('Disabled project notification', async () => {
    const tm = await prisma.team.create({ data: { name: 'Team 1' } })
    const u1 = await prisma.user.create({
      data: { name: 'u1', email: 'u1-disabled@example.com', password: 'p' },
    })
    const p2 = await prisma.project.create({
      data: { name: 'Project 2', teamId: tm.id, enableNotification: false },
    })

    const svc = notificationService

    await svc['createAsync']({
      type: NotificationType.comment_created,
      teamId: tm.id,
      projectId: p2.id,
      creatorId: u1.id,
    })

    const count = await prisma.notification.count({ where: { projectId: p2.id } })
    expect(count).toBe(0)
  })

  it('List all and Mark Read', async () => {
    const tm = await prisma.team.create({ data: { name: 'Team 1' } })
    const u1 = await prisma.user.create({
      data: { name: 'u1', email: 'u1-list@example.com', password: 'p' },
    })
    const member = await prisma.teamMember.create({
      data: { teamId: tm.id, userId: u1.id, role: 'owner' },
    })

    // Create notifications directly
    // Using string IDs that are sorted correctly
    const n1 = await prisma.notification.create({
      data: {
        id: '001',
        teamId: tm.id,
        type: NotificationType.comment_created,
        createdAt: new Date(Date.now() - 3000),
      },
    })
    const n2 = await prisma.notification.create({
      data: {
        id: '002',
        teamId: tm.id,
        type: NotificationType.reply_created,
        createdAt: new Date(Date.now() - 2000),
      },
    })
    const n3 = await prisma.notification.create({
      data: {
        id: '003',
        teamId: tm.id,
        type: NotificationType.mention,
        userId: u1.id,
        createdAt: new Date(Date.now() - 1000),
      },
    })

    const svc = notificationService

    // List all
    const resAll = await svc.list(tm.id, u1.id, {})
    expect(resAll.data).toHaveLength(3)
    // Ordered by desc createdAt
    expect(resAll.data[0].id).toBe(n3.id)
    expect(resAll.data[1].id).toBe(n2.id)
    expect(resAll.data[2].id).toBe(n1.id)
    expect(resAll.data[0].isRead).toBe(false)

    // Mark Read
    await svc.markRead(tm.id, u1.id, n2.id)

    const m = await prisma.teamMember.findUnique({
      where: { id: member.id },
      include: { lastReadNotification: true },
    })
    expect(m?.lastReadNotification?.id).toBe(n2.id)

    // List again
    const resRead = await svc.list(tm.id, u1.id, {})
    expect(resRead.data[0].isRead).toBe(false) // n3
    expect(resRead.data[1].isRead).toBe(true) // n2
    expect(resRead.data[2].isRead).toBe(true) // n1 (read because n2 is newer)
  })

  it('List Unread Only', async () => {
    const tm = await prisma.team.create({ data: { name: 'Team 1' } })
    const u1 = await prisma.user.create({
      data: { name: 'u1', email: `u1-${Date.now()}@example.com`, password: 'p' },
    })
    await prisma.teamMember.create({
      data: { teamId: tm.id, userId: u1.id, role: 'owner' },
    })

    await prisma.notification.create({
      data: {
        id: '001',
        teamId: tm.id,
        type: NotificationType.comment_created,
        createdAt: new Date(Date.now() - 3000),
      },
    })
    const n2 = await prisma.notification.create({
      data: {
        id: '002',
        teamId: tm.id,
        type: NotificationType.reply_created,
        createdAt: new Date(Date.now() - 2000),
      },
    })
    const n3 = await prisma.notification.create({
      data: {
        id: '003',
        teamId: tm.id,
        type: NotificationType.mention,
        userId: u1.id,
        createdAt: new Date(Date.now() - 1000),
      },
    })

    const svc = notificationService
    await svc.markRead(tm.id, u1.id, n2.id)

    const resUnread = await svc.list(tm.id, u1.id, { unreadOnly: true })
    expect(resUnread.data).toHaveLength(1)
    expect(resUnread.data[0].id).toBe(n3.id)
  })

  it('Filter Self Notifications', async () => {
    const tm = await prisma.team.create({ data: { name: 'Team 1' } })
    const u1 = await prisma.user.create({
      data: { name: 'u1', email: `u1-${Date.now()}@example.com`, password: 'p' },
    })
    await prisma.teamMember.create({
      data: { teamId: tm.id, userId: u1.id, role: 'owner' },
    })

    const nSelf = await prisma.notification.create({
      data: { id: '004', teamId: tm.id, type: NotificationType.comment_created, creatorId: u1.id },
    })

    const svc = notificationService
    const res = await svc.list(tm.id, u1.id, {})

    const containsSelf = res.data.some((n) => n.id === nSelf.id)
    expect(containsSelf).toBe(false)
  })

  it('Project Member scoping', async () => {
    const tm = await prisma.team.create({ data: { name: 'Team 1' } })
    const p1 = await prisma.project.create({ data: { name: 'p1', teamId: tm.id } })
    const p2 = await prisma.project.create({ data: { name: 'p2', teamId: tm.id } })
    const u1 = await prisma.user.create({
      data: { name: 'u1', email: `u1-${Date.now()}@example.com`, password: 'p' },
    })

    const member = await prisma.teamMember.create({
      data: { teamId: tm.id, userId: u1.id, role: 'reviewer', scope: 'project' },
    })

    await prisma.projectMember.create({
      data: { projectId: p1.id, teamMemberId: member.id, role: 'editor' },
    })

    await prisma.notification.create({
      data: { id: '001', teamId: tm.id, projectId: p1.id, type: NotificationType.comment_created },
    })
    await prisma.notification.create({
      data: { id: '002', teamId: tm.id, projectId: p2.id, type: NotificationType.comment_created },
    })
    await prisma.notification.create({
      data: { id: '003', teamId: tm.id, type: NotificationType.mention, userId: u1.id },
    })

    const svc = notificationService
    const res = await svc.list(tm.id, u1.id, {})

    // Should see p1 and the targeted mention, but not p2
    expect(res.data).toHaveLength(2)
    const p2Notification = res.data.find((n) => n.id === '002')
    expect(p2Notification).toBeUndefined()
  })

  it('Respects user metadata notification settings', async () => {
    const tm = await prisma.team.create({ data: { name: 'Team 1' } })
    const u1 = await prisma.user.create({
      data: { name: 'u1', email: `u1-${Date.now()}@example.com`, password: 'p' },
    })
    const u2 = await prisma.user.create({
      data: { name: 'u2', email: `u2-${Date.now()}@example.com`, password: 'p' },
    })
    await prisma.teamMember.create({
      data: { teamId: tm.id, userId: u1.id, role: 'owner' },
    })

    // Create comments, replies, mentions, uploads, etc.
    const commentNotif = await prisma.notification.create({
      data: { id: '001', teamId: tm.id, type: NotificationType.comment_created },
    })
    const replyNotif = await prisma.notification.create({
      data: { id: '002', teamId: tm.id, type: NotificationType.reply_created, userId: u1.id },
    })
    const uploadNotifOther = await prisma.notification.create({
      data: {
        id: '003',
        teamId: tm.id,
        type: NotificationType.successful_file_uploaded,
        creatorId: u2.id,
      },
    })
    const uploadNotifSelf = await prisma.notification.create({
      data: {
        id: '004',
        teamId: tm.id,
        type: NotificationType.successful_file_uploaded,
        creatorId: u1.id,
      },
    })

    const svc = notificationService

    // Default settings: comments=true, replies=true, mentions=true, yourUploads=false, otherUploads=true
    const resDefault = await svc.list(tm.id, u1.id, {})
    expect(resDefault.data.some((n) => n.id === commentNotif.id)).toBe(true)
    expect(resDefault.data.some((n) => n.id === replyNotif.id)).toBe(true)
    expect(resDefault.data.some((n) => n.id === uploadNotifOther.id)).toBe(true)
    expect(resDefault.data.some((n) => n.id === uploadNotifSelf.id)).toBe(false) // yourUploads is false by default

    // Disable comments and replies, but enable yourUploads
    await userMetadataService.upsertMetadata(u1.id, tm.id, 'notification_settings', {
      comments: false,
      replies: false,
      mentions: true,
      yourUploads: true,
      otherUploads: false,
      statusUpdates: true,
    })

    const resCustom = await svc.list(tm.id, u1.id, {})
    expect(resCustom.data.some((n) => n.id === commentNotif.id)).toBe(false)
    expect(resCustom.data.some((n) => n.id === replyNotif.id)).toBe(false)
    expect(resCustom.data.some((n) => n.id === uploadNotifOther.id)).toBe(false) // otherUploads is now false
    expect(resCustom.data.some((n) => n.id === uploadNotifSelf.id)).toBe(true) // yourUploads is now true
  })

  it('getUnreadCount retrieves correct count of unread notifications', async () => {
    const tm = await prisma.team.create({ data: { name: 'Team 2' } })
    const u1 = await prisma.user.create({
      data: { name: 'u3', email: `u3-${Date.now()}@example.com`, password: 'p' },
    })
    const u2 = await prisma.user.create({
      data: { name: 'u4', email: `u4-${Date.now()}@example.com`, password: 'p' },
    })
    const member = await prisma.teamMember.create({
      data: { teamId: tm.id, userId: u1.id, role: 'owner' },
    })

    // No notifications initially
    let count = await notificationService.getUnreadCount(tm.id, u1.id)
    expect(count).toBe(0)

    // Create unread notifications from other user
    const n1 = await prisma.notification.create({
      data: { id: '101', teamId: tm.id, type: NotificationType.comment_created, creatorId: u2.id },
    })
    const n2 = await prisma.notification.create({
      data: {
        id: '102',
        teamId: tm.id,
        type: NotificationType.reply_created,
        userId: u1.id,
        creatorId: u2.id,
      },
    })

    count = await notificationService.getUnreadCount(tm.id, u1.id)
    expect(count).toBe(2)

    // Mark up to n1 as read
    await prisma.teamMember.update({
      where: { id: member.id },
      data: { lastReadNotificationId: n1.id },
    })

    count = await notificationService.getUnreadCount(tm.id, u1.id)
    expect(count).toBe(1) // n2 is still unread

    // Mark all as read (up to n2)
    await prisma.teamMember.update({
      where: { id: member.id },
      data: { lastReadNotificationId: n2.id },
    })

    count = await notificationService.getUnreadCount(tm.id, u1.id)
    expect(count).toBe(0)
  })
})
